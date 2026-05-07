import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { missingServerEnv, serverEnv } from "@/lib/env.server";
import type { ApifyClient } from "apify-client";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Constants (mirrored from scrape-and-cluster.ts) ─────────────────────────

const ACTOR_TIMEOUT_SECS = 300;
const BATCH_SIZE = 30;

const POLITICAL_KWS = [
  "trump",
  "biden",
  "democrat",
  "republican",
  "liberal",
  "conservative",
  "election",
  "vote",
  "congress",
  "senate",
  "maga",
  "abortion",
  "gun control",
  "immigration policy",
  "political party",
];

const RELEVANCE_KWS = [
  "workflow",
  "tool",
  "software",
  "app",
  "platform",
  "automate",
  "wish",
  "hate",
  "tired",
  "frustrated",
  "annoying",
  "painful",
  "manual",
  "tedious",
  "broken",
  "integration",
  "api",
  "dashboard",
  "report",
  "track",
  "manage",
  "process",
  "hours wasted",
  "every week",
  "productivity",
  "inefficient",
  "should exist",
  "missing feature",
  "no solution",
  "can't find",
  "why doesn't",
  "why isn't",
  "someone should",
  "nightmare",
  "i wish",
  "there's no",
  "please build",
  "build this",
  "problem",
  "challenge",
  "pain point",
  "struggle",
  "difficult",
  "impossible",
  "workaround",
];

const RESEARCH_DOMAINS = [
  "ncbi.nlm.nih.gov",
  "researchgate.net",
  "pubmed",
  "arxiv.org",
  "springer.com",
  "ieee.org",
  "sciencedirect.com",
  "academia.edu",
  "semanticscholar.org",
  "jstor.org",
  "nature.com",
  "science.org",
];

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawItem {
  platform: "twitter" | "google";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fingerprint(text: string): string {
  return createHash("sha256")
    .update(text.toLowerCase().replace(/\s+/g, " ").slice(0, 200))
    .digest("hex")
    .slice(0, 16);
}

function formatTAM(usd: number): string {
  if (!usd || isNaN(usd)) return "Unknown";
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

function isRelevant(item: RawItem): boolean {
  const text = `${item.title} ${item.content}`.toLowerCase();
  if (POLITICAL_KWS.some((kw) => text.includes(kw))) return false;
  if (item.platform === "google" && RESEARCH_DOMAINS.some((d) => item.url.includes(d)))
    return false;
  // For topic-specific searches, be more lenient — include if it mentions the topic context
  return RELEVANCE_KWS.some((kw) => text.includes(kw)) || text.length > 100;
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────

async function scrapeTwitter(apify: ApifyClient, queries: string[]): Promise<RawItem[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const datedQueries = queries.map((q) => `${q} since:${since} -is:retweet lang:en`);

  const run = await apify
    .actor("apidojo/tweet-scraper")
    .call(
      { searchTerms: datedQueries, maxItems: 60, queryType: "Top", lang: "en" },
      { waitSecs: ACTOR_TIMEOUT_SECS },
    );

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .filter((i) => i.text || i.full_text)
    .map(
      (i): RawItem => ({
        platform: "twitter",
        title: String(i.text ?? i.full_text ?? "").slice(0, 120),
        content: String(i.text ?? i.full_text ?? ""),
        url: String(i.url ?? i.twitterUrl ?? `https://x.com/i/web/status/${i.id ?? ""}`),
        score: Number(i.likeCount ?? i.favorite_count ?? 0),
      }),
    );
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
    { waitSecs: ACTOR_TIMEOUT_SECS },
  );

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();

  const results: RawItem[] = [];
  for (const page of items as Record<string, unknown>[]) {
    const organic = (page.organicResults ?? []) as Record<string, unknown>[];
    for (const r of organic) {
      if (!r.title && !r.description && !r.snippet) continue;
      results.push({
        platform: "google",
        title: String(r.title ?? ""),
        content: String(r.description ?? r.snippet ?? ""),
        url: String(r.url ?? r.link ?? ""),
        score: 0,
      });
    }
  }
  return results;
}

// ─── Claude Clustering ────────────────────────────────────────────────────────

async function clusterBatch(anthropic: Anthropic, batch: RawItem[]): Promise<ClaudeOpportunity[]> {
  const userContent = batch
    .map(
      (item, i) =>
        `[${i + 1}] Platform: ${item.platform}\nTitle: ${item.title}\nContent: ${item.content.slice(0, 500)}\nURL: ${item.url}`,
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

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]) as ClaudeOpportunity[];
  } catch {
    return [];
  }
}

// ─── Supabase Upsert ──────────────────────────────────────────────────────────

async function upsertOpportunities(opps: ClaudeOpportunity[]): Promise<string[]> {
  if (!opps.length) return [];

  const rows = opps
    .filter(
      (o) =>
        o.title &&
        o.pain &&
        typeof o.urgency_score === "number" &&
        o.urgency_score >= 1 &&
        o.urgency_score <= 10,
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
      sources: [...new Set((o.sources ?? []).map((s) => s.platform))].filter(Boolean),
      sources_detail: o.sources ?? [],
      is_hot: (o.urgency_score ?? 0) >= 8,
      dedup_hash: fingerprint(o.title),
    }));

  // Cast to any — sources_detail/dedup_hash exist in DB but aren't in generated types
  const { data, error } = await supabaseAdmin
    .from("opportunities")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as any[], { onConflict: "dedup_hash", ignoreDuplicates: true })
    .select("id");

  if (error) {
    const { data: ins } = await supabaseAdmin
      .from("opportunities")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any[])
      .select("id");
    return (ins ?? []).map((r) => r.id as string);
  }

  return (data ?? []).map((r) => r.id as string);
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

async function runExplorePipeline(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  topic: string,
): Promise<void> {
  const enc = new TextEncoder();
  const send = (event: string, data: object) => {
    try {
      writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      // client disconnected
    }
  };

  const missing = missingServerEnv(["APIFY_TOKEN", "ANTHROPIC_API_KEY"]);
  if (missing.length > 0) {
    send("error", { message: `Missing ${missing.join(" or ")} env vars` });
    return;
  }
  const apifyToken = serverEnv("APIFY_TOKEN")!;
  const anthropicKey = serverEnv("ANTHROPIC_API_KEY")!;

  const { ApifyClient } = await import("apify-client");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const apify = new ApifyClient({ token: apifyToken });
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    // ── 1. Scrape X/Twitter ───────────────────────────────────────────────────
    send("status", { message: `Searching X for "${topic}" pain points…` });

    const twitterQueries = [
      `"${topic}" "wish there was"`,
      `"${topic}" frustrated problems`,
      `"${topic}" "why isn't there"`,
      `"${topic}" "someone should build"`,
    ];

    const [twitterItems, googleItems] = await Promise.allSettled([
      scrapeTwitter(apify, twitterQueries),
      (async () => {
        send("status", { message: `Searching Quora and LinkedIn for "${topic}" complaints…` });
        const googleQueries = [
          `site:quora.com "${topic}" problem frustrated`,
          `site:quora.com "${topic}" "I wish there was"`,
          `site:linkedin.com/pulse "${topic}" challenges pain`,
          `"${topic}" painful problems tool missing`,
          `"${topic}" software complaint frustrated users`,
        ];
        return scrapeGoogle(apify, googleQueries);
      })(),
    ]);

    const raw: RawItem[] = [];
    if (twitterItems.status === "fulfilled") raw.push(...twitterItems.value);
    if (googleItems.status === "fulfilled") raw.push(...googleItems.value);

    // ── 2. Dedup + filter ────────────────────────────────────────────────────
    const seen = new Set<string>();
    const filtered: RawItem[] = [];
    for (const item of raw) {
      if (!item.content && !item.title) continue;
      const hash = fingerprint(`${item.url}${item.title}${item.content.slice(0, 80)}`);
      if (seen.has(hash)) continue;
      if (!isRelevant(item)) continue;
      seen.add(hash);
      filtered.push(item);
    }

    if (filtered.length === 0) {
      send("error", {
        message:
          "No relevant pain points found for this topic. Try a more specific industry or product category.",
      });
      return;
    }

    // ── 3. Cluster with Claude ───────────────────────────────────────────────
    send("status", { message: `Analyzing ${filtered.length} signals with AI…` });

    const allOpps: ClaudeOpportunity[] = [];
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      const opps = await clusterBatch(anthropic, batch);
      allOpps.push(...opps);
    }

    if (allOpps.length === 0) {
      send("error", {
        message: "AI found no structured opportunities in these results. Try a different topic.",
      });
      return;
    }

    // ── 4. Upsert to DB ──────────────────────────────────────────────────────
    send("status", { message: `Saving ${allOpps.length} opportunities to feed…` });
    await upsertOpportunities(allOpps);

    // ── 5. Fetch saved rows to return full Opportunity objects ───────────────
    const hashes = allOpps.map((o) => fingerprint(o.title));
    const { data: saved } = await supabaseAdmin
      .from("opportunities")
      .select("*")
      .in("dedup_hash", hashes);

    send("done", { opportunities: saved ?? [], topic });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    send("error", { message });
  } finally {
    try {
      await writer.close();
    } catch {
      // Client disconnected.
    }
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/explore/")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { topic?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const topic = (body.topic ?? "").trim().slice(0, 120);
        if (!topic) {
          return new Response(JSON.stringify({ error: "topic is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { writable, readable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();

        runExplorePipeline(writer, topic).catch(async (err: unknown) => {
          const enc = new TextEncoder();
          const msg = err instanceof Error ? err.message : "Internal error";
          try {
            await writer.write(
              enc.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`),
            );
            await writer.close();
          } catch {
            // Client disconnected.
          }
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
