#!/usr/bin/env node
/**
 * scrape-and-cluster.ts
 *
 * Continuously scrapes Reddit / Twitter / Hacker News / Google,
 * clusters complaints with Claude claude-opus-4-7, and upserts startup
 * opportunities into Supabase.
 *
 * Usage:
 *   node --experimental-strip-types scripts/scrape-and-cluster.ts
 *   node --experimental-strip-types scripts/scrape-and-cluster.ts --seed
 *
 * Required env vars:
 *   APIFY_TOKEN
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL           (e.g. https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { createHash } from "crypto";

loadEnv();

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 30;
const LOOP_SLEEP_MS = 60_000;
const ACTOR_TIMEOUT_SECS = 180;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];

const POLITICAL_KWS = [
  "trump", "biden", "democrat", "republican", "liberal", "conservative",
  "election", "vote", "congress", "senate", "maga", "abortion", "gun control",
  "immigration policy", "political party",
];

const RELEVANCE_KWS = [
  "workflow", "tool", "software", "app", "platform", "automate", "wish",
  "hate", "tired", "frustrated", "annoying", "painful", "manual", "tedious",
  "broken", "integration", "api", "dashboard", "report", "track", "manage",
  "process", "hours wasted", "every week", "productivity", "inefficient",
  "should exist", "missing feature", "no solution", "can't find",
  "why doesn't", "why isn't", "someone should", "nightmare", "i wish",
  "there's no", "please build", "build this",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawItem {
  platform: "reddit" | "twitter" | "hackernews" | "google";
  title: string;
  content: string;
  url: string;
  score: number;
}

interface ClaudeOpportunity {
  title: string;
  pain: string;
  icp: string;
  market_size_usd: number;
  urgency_score: number;
  why_now: string;
  competitors: Array<{ name: string; pricing_hint: string; weakness: string }>;
  mvp_features: string[];
  sources: Array<{ platform: string; snippet: string; url: string }>;
}

interface ScrapeProfile {
  id: number;
  subreddits: string[];
  twitterQueries: string[];
  googleQueries: string[];
}

// ─── Seed Profiles ────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: ScrapeProfile = {
  id: 0,
  subreddits: ["smallbusiness", "freelance", "SaaS", "Entrepreneur", "sysadmin", "devops"],
  twitterQueries: ["I wish there was", "why isn't there", "someone should build", "tired of"],
  googleQueries: ["product hunt complaints bad software", "site:producthunt.com negative review"],
};

const SEED_PROFILES: ScrapeProfile[] = [
  {
    id: 1,
    subreddits: ["smallbusiness", "freelance"],
    twitterQueries: ["I wish there was a tool for", "no app for this"],
    googleQueries: ["product hunt frustration workflow tool missing"],
  },
  {
    id: 2,
    subreddits: ["SaaS", "Entrepreneur"],
    twitterQueries: ["why isn't there an app", "startup idea nobody built"],
    googleQueries: ["startup pain point no solution exists"],
  },
  {
    id: 3,
    subreddits: ["sysadmin", "devops"],
    twitterQueries: ["someone should build this", "frustrated with tooling"],
    googleQueries: ["devops tool painful workflow gap missing"],
  },
  {
    id: 4,
    subreddits: ["productivity", "programming"],
    twitterQueries: ["tired of spreadsheets for", "manual process I hate"],
    googleQueries: ["software pain point user complaints 2025"],
  },
  {
    id: 5,
    subreddits: ["startups", "marketing"],
    twitterQueries: ["can't believe there's no tool", "wish someone would build"],
    googleQueries: ["product hunt bad review broken automation"],
  },
  {
    id: 6,
    subreddits: ["aws", "kubernetes"],
    twitterQueries: ["annoyed by lack of", "cloud tooling nightmare"],
    googleQueries: ["AWS developer workflow painful gap missing feature"],
  },
  {
    id: 7,
    subreddits: ["automation", "nocode"],
    twitterQueries: ["hours wasted on manual", "nobody built this yet"],
    googleQueries: ["no-code tool missing request build this"],
  },
  {
    id: 8,
    subreddits: ["sales", "CustomerSuccess"],
    twitterQueries: ["nightmare workflow sales", "CRM broken hate"],
    googleQueries: ["CRM complaint broken sales tool pain"],
  },
  {
    id: 9,
    subreddits: ["remotework", "consulting"],
    twitterQueries: ["remote work tool missing", "broken workflow client"],
    googleQueries: ["remote work software gap complaint frustration"],
  },
  {
    id: 10,
    subreddits: ["datascience", "MachineLearning"],
    twitterQueries: ["data tooling frustration", "ML workflow nightmare"],
    googleQueries: ["data science workflow tool complaint missing"],
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function retry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = MAX_RETRIES
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const delay = RETRY_DELAYS_MS[i] ?? 30_000;
      log(`[RETRY ${i + 1}/${attempts}] ${label}: ${msg}. Waiting ${delay / 1000}s…`);
      if (i < attempts - 1) await sleep(delay);
    }
  }
  log(`[FAIL] ${label} gave up after ${attempts} attempts`);
  return null;
}

function fingerprint(text: string): string {
  return createHash("sha256")
    .update(text.toLowerCase().replace(/\s+/g, " ").slice(0, 200))
    .digest("hex")
    .slice(0, 16);
}

function isRelevant(item: RawItem): boolean {
  const text = `${item.title} ${item.content}`.toLowerCase();
  if (POLITICAL_KWS.some((kw) => text.includes(kw))) return false;
  // Reddit: drop low-karma posts (likely spam/trolls)
  if (item.platform === "reddit" && item.score < 2) return false;
  return RELEVANCE_KWS.some((kw) => text.includes(kw));
}

function formatTAM(usd: number): string {
  if (!usd || isNaN(usd)) return "Unknown";
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

// ─── Apify Scrapers ───────────────────────────────────────────────────────────

async function scrapeReddit(apify: ApifyClient, subreddits: string[]): Promise<RawItem[]> {
  const run = await apify.actor("trudax/reddit-scraper").call(
    {
      startUrls: subreddits.map((s) => ({
        url: `https://www.reddit.com/r/${s}/top/?t=week`,
      })),
      maxItems: 50,
      includeComments: false,
      proxy: { useApifyProxy: true },
    },
    { waitSecs: ACTOR_TIMEOUT_SECS }
  );

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  log(`  [Reddit] ${items.length} posts from r/${subreddits.join(", r/")}`);

  return (items as Record<string, unknown>[])
    .filter((i) => i.title || i.selftext || i.body)
    .map((i): RawItem => ({
      platform: "reddit",
      title: String(i.title ?? ""),
      content: String(i.selftext ?? i.body ?? ""),
      url: String(i.url ?? `https://reddit.com${i.permalink ?? ""}`),
      score: Number(i.score ?? i.ups ?? 0),
    }));
}

async function scrapeTwitter(apify: ApifyClient, queries: string[]): Promise<RawItem[]> {
  const run = await apify.actor("apidojo/tweet-scraper").call(
    {
      searchTerms: queries,
      maxItems: 100,
      queryType: "Latest",
      lang: "en",
    },
    { waitSecs: ACTOR_TIMEOUT_SECS }
  );

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  log(`  [Twitter] ${items.length} tweets for: ${queries.slice(0, 2).join(" | ")}…`);

  return (items as Record<string, unknown>[])
    .filter((i) => i.text || i.full_text)
    .map((i): RawItem => ({
      platform: "twitter",
      title: String(i.text ?? i.full_text ?? "").slice(0, 120),
      content: String(i.text ?? i.full_text ?? ""),
      url: String(
        i.url ?? i.twitterUrl ?? `https://twitter.com/i/web/status/${i.id ?? ""}`
      ),
      score: Number(i.likeCount ?? i.favorite_count ?? 0),
    }));
}

async function scrapeHN(apify: ApifyClient): Promise<RawItem[]> {
  const run = await apify.actor("apify/website-content-crawler").call(
    {
      startUrls: [{ url: "https://news.ycombinator.com/ask" }],
      maxCrawlDepth: 1,
      maxCrawlPages: 30,
      maxCrawlItems: 40,
    },
    { waitSecs: ACTOR_TIMEOUT_SECS }
  );

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  log(`  [HN] ${items.length} pages`);

  return (items as Record<string, unknown>[])
    .filter((i) => i.text || i.markdown)
    .map((i): RawItem => {
      const meta = i.metadata as Record<string, unknown> | undefined;
      return {
        platform: "hackernews",
        title: String(meta?.title ?? i.url ?? ""),
        content: String(i.text ?? i.markdown ?? "").slice(0, 2000),
        url: String(i.url ?? i.canonicalUrl ?? ""),
        score: 0,
      };
    });
}

async function scrapeGoogle(apify: ApifyClient, queries: string[]): Promise<RawItem[]> {
  const run = await apify.actor("apify/google-search-scraper").call(
    {
      queries: queries.join("\n"),
      maxPagesPerQuery: 2,
      resultsPerPage: 10,
      countryCode: "us",
      languageCode: "en",
    },
    { waitSecs: ACTOR_TIMEOUT_SECS }
  );

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  log(`  [Google] ${items.length} results`);

  return (items as Record<string, unknown>[])
    .filter((i) => i.title || i.snippet)
    .map((i): RawItem => ({
      platform: "google",
      title: String(i.title ?? ""),
      content: String(i.snippet ?? i.description ?? ""),
      url: String(i.url ?? i.link ?? ""),
      score: 0,
    }));
}

// ─── Parallel Scrape ──────────────────────────────────────────────────────────

async function scrapeAll(apify: ApifyClient, profile: ScrapeProfile): Promise<RawItem[]> {
  log(`[Scrape] Profile ${profile.id} — launching 4 actors in parallel`);

  const settled = await Promise.allSettled([
    retry(() => scrapeReddit(apify, profile.subreddits), `Reddit-${profile.id}`),
    retry(() => scrapeTwitter(apify, profile.twitterQueries), `Twitter-${profile.id}`),
    retry(() => scrapeHN(apify), `HN-${profile.id}`),
    retry(() => scrapeGoogle(apify, profile.googleQueries), `Google-${profile.id}`),
  ]);

  const items: RawItem[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) items.push(...r.value);
  }

  log(`[Scrape] Profile ${profile.id} — ${items.length} raw items collected`);
  return items;
}

// ─── Dedup + Filter ───────────────────────────────────────────────────────────

function dedupeAndFilter(items: RawItem[], seen: Set<string>): RawItem[] {
  const kept: RawItem[] = [];
  for (const item of items) {
    if (!item.content && !item.title) continue;
    const hash = fingerprint(`${item.url}${item.title}${item.content.slice(0, 80)}`);
    if (seen.has(hash)) continue;
    if (!isRelevant(item)) continue;
    seen.add(hash);
    kept.push(item);
  }
  log(`[Filter] ${kept.length} / ${items.length} items kept after dedup + relevance filter`);
  return kept;
}

// ─── Claude Clustering ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a venture analyst. Given these public complaints, output a JSON array of distinct startup opportunities. For each:
{
  title: string (max 8 words),
  pain: string (1 sentence),
  icp: string (who has this pain),
  market_size_usd: number (your best estimate of annual TAM),
  urgency_score: 1-10,
  why_now: string,
  competitors: [{name, pricing_hint, weakness}],
  mvp_features: [string],
  sources: [{platform, snippet, url}]
}
Cluster similar complaints into one opportunity. Skip generic ones.
Output ONLY valid JSON, no preamble.`;

async function clusterBatch(
  anthropic: Anthropic,
  batch: RawItem[]
): Promise<ClaudeOpportunity[]> {
  const userContent = batch
    .map(
      (item, i) =>
        `[${i + 1}] Platform: ${item.platform}\nTitle: ${item.title}\nContent: ${item.content.slice(0, 500)}\nURL: ${item.url}`
    )
    .join("\n\n---\n\n");

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract startup opportunities from these ${batch.length} posts:\n\n${userContent}`,
      },
    ],
  });

  const raw = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip optional ```json fences
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    log(`[Claude] No JSON array found in response (batch of ${batch.length})`);
    return [];
  }

  try {
    const opps = JSON.parse(match[0]) as ClaudeOpportunity[];
    log(`[Claude] ${opps.length} opportunities from batch of ${batch.length}`);
    return opps;
  } catch (err) {
    log(`[Claude] JSON parse failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ─── Supabase Upsert ──────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>;

async function upsertOpportunities(
  supabase: SupabaseClient,
  opps: ClaudeOpportunity[]
): Promise<number> {
  if (!opps.length) return 0;

  const rows = opps
    .filter(
      (o) =>
        o.title &&
        o.pain &&
        typeof o.urgency_score === "number" &&
        o.urgency_score >= 1 &&
        o.urgency_score <= 10
    )
    .map((o) => ({
      title: o.title.slice(0, 200),
      pain_summary: o.pain,
      pain_description: o.pain,
      icp: o.icp ?? "B2B professionals",
      tam_estimate: formatTAM(o.market_size_usd ?? 0),
      urgency_score: Math.min(10, Math.max(1, Math.round(o.urgency_score))),
      why_now: o.why_now ?? "",
      competitors: o.competitors ?? [],
      mvp_features: o.mvp_features ?? [],
      sources: (o.sources ?? []).map((s) => s.url).filter(Boolean),
      sources_detail: o.sources ?? [],
      is_hot: (o.urgency_score ?? 0) >= 8,
      dedup_hash: fingerprint(o.title),
    }));

  const { data, error } = await supabase
    .from("opportunities")
    .upsert(rows, { onConflict: "dedup_hash", ignoreDuplicates: true })
    .select("id");

  if (error) {
    log(`[Supabase] Upsert error: ${error.message}`);
    return 0;
  }

  const count = data?.length ?? 0;
  log(`[Supabase] Inserted ${count} new rows`);
  return count;
}

// ─── Pipeline (one full cycle) ────────────────────────────────────────────────

async function runPipeline(
  apify: ApifyClient,
  anthropic: Anthropic,
  supabase: SupabaseClient,
  profile: ScrapeProfile,
  seen: Set<string>
): Promise<number> {
  log(`\n${"─".repeat(60)}`);
  log(`[Pipeline] Profile ${profile.id} — scraping`);

  const raw = await scrapeAll(apify, profile);
  const filtered = dedupeAndFilter(raw, seen);

  if (!filtered.length) {
    log(`[Pipeline] Profile ${profile.id} — nothing new after filtering`);
    return 0;
  }

  const batches: RawItem[][] = [];
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    batches.push(filtered.slice(i, i + BATCH_SIZE));
  }

  log(`[Pipeline] Profile ${profile.id} — ${batches.length} Claude batch(es) queued`);

  let total = 0;
  for (let i = 0; i < batches.length; i++) {
    log(`[Pipeline] Batch ${i + 1}/${batches.length}`);
    const opps = await retry(
      () => clusterBatch(anthropic, batches[i]),
      `Claude batch ${i + 1} / profile ${profile.id}`
    );
    if (opps?.length) {
      total += await upsertOpportunities(supabase, opps);
    }
    if (i < batches.length - 1) await sleep(2_000); // gentle rate-limit buffer
  }

  log(`[Pipeline] Profile ${profile.id} done — ${total} new opportunities`);
  return total;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const missing = (
    ["APIFY_TOKEN", "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const
  ).filter((k) => !process.env[k]);

  if (missing.length) {
    process.stderr.write(`Missing env vars: ${missing.join(", ")}\n`);
    process.exit(1);
  }

  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN! });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const isSeed = process.argv.includes("--seed");
  log(`[Main] Untapt scraper — mode: ${isSeed ? "SEED (10× parallel)" : "CONTINUOUS"}`);

  if (isSeed) {
    log(`[Seed] Launching ${SEED_PROFILES.length} profiles in parallel`);
    const seen = new Set<string>();

    const results = await Promise.allSettled(
      SEED_PROFILES.map((p) => runPipeline(apify, anthropic, supabase, p, seen))
    );

    let grand = 0;
    for (const [i, r] of results.entries()) {
      if (r.status === "fulfilled") {
        grand += r.value;
        log(`[Seed] Profile ${SEED_PROFILES[i].id}: +${r.value}`);
      } else {
        log(`[Seed] Profile ${SEED_PROFILES[i].id}: FAILED — ${r.reason}`);
      }
    }
    log(`[Seed] Complete — ${grand} total opportunities inserted`);
    process.exit(0);
  }

  // Continuous mode
  const seen = new Set<string>();
  let cycle = 0;
  let grand = 0;

  while (true) {
    cycle++;
    log(`\n${"═".repeat(60)}`);
    log(`[Main] CYCLE ${cycle} starting`);

    const inserted = await runPipeline(apify, anthropic, supabase, DEFAULT_PROFILE, seen);
    grand += inserted;

    log(`[Main] Cycle ${cycle} done (+${inserted}). Total: ${grand}. Sleeping ${LOOP_SLEEP_MS / 1000}s…`);
    await sleep(LOOP_SLEEP_MS);
  }
}

main().catch((err) => {
  process.stderr.write(`[FATAL] ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
