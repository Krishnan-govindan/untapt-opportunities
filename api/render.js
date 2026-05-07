import { pathToFileURL } from "url";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, "../dist/server/server.js");

let _server;
async function getServer() {
  if (!_server) {
    const mod = await import(pathToFileURL(serverPath).href);
    _server = mod.default;
  }
  return _server;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function readBody(req) {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      try {
        resolve(buf.length ? JSON.parse(buf.toString()) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

async function pipeWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  if (!webRes.body) {
    res.end();
    return;
  }
  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) await new Promise((r) => res.once("drain", r));
    }
  } finally {
    res.end();
  }
}

// ── /api/agent ────────────────────────────────────────────────────────────────

function buildAgentSystem(context) {
  if (context?.type === "opportunity" && context.opportunity) {
    const o = context.opportunity;
    return `You are an expert startup advisor analyzing: "${o.title}". TAM: ${o.tam_estimate}. Urgency: ${o.urgency_score}/10. Pain: ${o.pain_summary}.\n\nHelp evaluate this opportunity.`;
  }
  if (context?.type === "feed") {
    const parts = [];
    if (context.query) parts.push(`Search: "${context.query}"`);
    if (context.filter && context.filter !== "all") parts.push(`Filter: ${context.filter}`);
    const ctx = parts.length ? ` ${parts.join(". ")}.` : "";
    return `You are an expert startup advisor.${ctx} Help the user explore unmonetized startup opportunities from Reddit, X, HN, and Product Hunt.`;
  }
  return "You are an expert startup advisor helping evaluate unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt. Help the user explore opportunities and evaluate which are worth pursuing.";
}

async function handleAgent(req, res) {
  try {
    const body = await readBody(req);
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { streamText } = await import("ai");
    const result = await streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: buildAgentSystem(body.context ?? {}),
      messages: body.messages ?? [],
      maxTokens: 512,
    });
    await pipeWebResponse(result.toUIMessageStreamResponse(), res);
  } catch (err) {
    console.error("Agent error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: String(err) }));
    }
  }
}

// ── /api/explore ──────────────────────────────────────────────────────────────

const POLITICAL_KWS = [
  "trump",
  "biden",
  "democrat",
  "republican",
  "election",
  "vote",
  "congress",
  "maga",
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
  "dashboard",
  "report",
  "track",
  "manage",
  "process",
  "productivity",
  "inefficient",
  "should exist",
  "missing feature",
  "no solution",
  "can't find",
  "why doesn't",
  "someone should",
  "nightmare",
  "i wish",
  "there's no",
  "please build",
  "pain point",
  "struggle",
];
const RESEARCH_DOMAINS = [
  "ncbi.nlm.nih.gov",
  "researchgate.net",
  "pubmed",
  "arxiv.org",
  "springer.com",
  "ieee.org",
  "sciencedirect.com",
];
const SYSTEM_PROMPT = `You are a venture analyst. Given public complaints, output a JSON array of distinct startup opportunities. For each:
{"title":string,"pain":string,"icp":string,"market_size_usd":number,"urgency_score":1-10,"why_now":string,"competitors":[{"name":string,"pricing_hint":string,"weakness":string}],"mvp_features":[string],"sources":[{"platform":string,"snippet":string,"url":string}]}
Cluster similar complaints. Skip generic ones. Output ONLY valid JSON, no preamble.`;

function fpHash(text) {
  return createHash("sha256")
    .update(text.toLowerCase().replace(/\s+/g, " ").slice(0, 200))
    .digest("hex")
    .slice(0, 16);
}

function formatTAM(usd) {
  if (!usd || isNaN(usd)) return "Unknown";
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

function isRelevant(item) {
  const text = `${item.title} ${item.content}`.toLowerCase();
  if (POLITICAL_KWS.some((kw) => text.includes(kw))) return false;
  if (item.platform === "google" && RESEARCH_DOMAINS.some((d) => item.url.includes(d)))
    return false;
  return RELEVANCE_KWS.some((kw) => text.includes(kw)) || text.length > 100;
}

async function handleExplore(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  try {
    const body = await readBody(req);
    const topic = (body.topic ?? "").trim().slice(0, 120);
    if (!topic) {
      send("error", { message: "topic is required" });
      res.end();
      return;
    }

    const apifyToken = process.env.APIFY_TOKEN;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!apifyToken || !anthropicKey) {
      send("error", { message: "Missing API keys" });
      res.end();
      return;
    }

    const { ApifyClient } = await import("apify-client");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { createClient } = await import("@supabase/supabase-js");

    const apify = new ApifyClient({ token: apifyToken });
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const supabase = createClient(
      process.env.APP_SUPABASE_URL,
      process.env.APP_SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── scrape twitter ──
    send("status", { message: `Searching X for "${topic}" pain points…` });
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const twitterQueries = [
      `"${topic}" "wish there was" since:${since} -is:retweet lang:en`,
      `"${topic}" frustrated problems since:${since} -is:retweet lang:en`,
      `"${topic}" "someone should build" since:${since} -is:retweet lang:en`,
    ];

    send("status", { message: `Searching Quora and Google for "${topic}" complaints…` });
    const googleQueries = [
      `site:quora.com "${topic}" problem frustrated`,
      `site:quora.com "${topic}" "I wish there was"`,
      `"${topic}" painful problems tool missing`,
      `"${topic}" software complaint frustrated users`,
    ];

    const [twResult, gResult] = await Promise.allSettled([
      (async () => {
        const run = await apify
          .actor("apidojo/tweet-scraper")
          .call(
            { searchTerms: twitterQueries, maxItems: 60, queryType: "Top", lang: "en" },
            { waitSecs: 120 },
          );
        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        return items
          .filter((i) => i.text || i.full_text)
          .map((i) => ({
            platform: "twitter",
            title: String(i.text ?? i.full_text ?? "").slice(0, 120),
            content: String(i.text ?? i.full_text ?? ""),
            url: String(i.url ?? `https://x.com/i/web/status/${i.id ?? ""}`),
            score: Number(i.likeCount ?? 0),
          }));
      })(),
      (async () => {
        const run = await apify.actor("apify/google-search-scraper").call(
          {
            queries: googleQueries.join("\n"),
            maxPagesPerQuery: 1,
            resultsPerPage: 10,
            countryCode: "us",
          },
          { waitSecs: 120 },
        );
        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        const results = [];
        for (const page of items) {
          for (const r of page.organicResults ?? []) {
            if (!r.title && !r.description) continue;
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
      })(),
    ]);

    const raw = [];
    if (twResult.status === "fulfilled") raw.push(...twResult.value);
    if (gResult.status === "fulfilled") raw.push(...gResult.value);

    const seen = new Set();
    const filtered = [];
    for (const item of raw) {
      if (!item.content && !item.title) continue;
      const hash = fpHash(`${item.url}${item.title}${item.content.slice(0, 80)}`);
      if (seen.has(hash) || !isRelevant(item)) continue;
      seen.add(hash);
      filtered.push(item);
    }

    if (!filtered.length) {
      send("status", {
        message: `No fresh web signals found for "${topic}".`,
      });
      send("done", {
        opportunities: [],
        topic,
        empty: true,
        message: `No fresh web research results were found for "${topic}". Saved feed results were not substituted.`,
      });
      res.end();
      return;
    }

    send("status", { message: `Analyzing ${filtered.length} signals with AI…` });

    const allOpps = [];
    const BATCH = 30;
    for (let i = 0; i < filtered.length; i += BATCH) {
      const batch = filtered.slice(i, i + BATCH);
      const userContent = batch
        .map(
          (item, idx) =>
            `[${idx + 1}] Platform: ${item.platform}\nTitle: ${item.title}\nContent: ${item.content.slice(0, 500)}\nURL: ${item.url}`,
        )
        .join("\n\n---\n\n");
      try {
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
          .map((b) => b.text)
          .join("");
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            allOpps.push(...JSON.parse(match[0]));
          } catch {}
        }
      } catch {}
    }

    if (!allOpps.length) {
      send("status", {
        message: `AI found no new structured opportunities for "${topic}".`,
      });
      send("done", {
        opportunities: [],
        topic,
        empty: true,
        message: `The web scrapers found signals for "${topic}", but AI could not extract a structured startup opportunity. Saved feed results were not substituted.`,
      });
      res.end();
      return;
    }

    send("status", { message: `Saving ${allOpps.length} opportunities to feed…` });

    const rows = allOpps
      .filter((o) => o.title && o.pain && typeof o.urgency_score === "number")
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
        dedup_hash: fpHash(o.title),
      }));

    await supabase
      .from("opportunities")
      .upsert(rows, { onConflict: "dedup_hash", ignoreDuplicates: true })
      .select("id");

    const hashes = rows.map((r) => r.dedup_hash);
    const { data: saved } = await supabase
      .from("opportunities")
      .select("*")
      .in("dedup_hash", hashes);

    send("done", { opportunities: saved ?? [], topic });
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url, `${protocol}://${host}`);

  if (url.pathname === "/api/agent" && req.method === "POST") return handleAgent(req, res);
  if (url.pathname === "/api/explore" && req.method === "POST") return handleExplore(req, res);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value != null) headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
    if (body.length === 0) body = undefined;
  }

  const webReq = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    ...(body ? { duplex: "half" } : {}),
  });

  const server = await getServer();
  const webRes = await server.fetch(webReq, process.env, {});

  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));

  if (!webRes.body) {
    res.end();
    return;
  }

  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) await new Promise((r) => res.once("drain", r));
    }
  } finally {
    res.end();
  }
}

export const config = { maxDuration: 60 };
