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
const EXPLORE_DEADLINE_MS = 52_000;
const GOOGLE_TIMEOUT_MS = 22_000;
const TWITTER_TIMEOUT_MS = 10_000;
const CLAUDE_TIMEOUT_MS = 18_000;
const SAVE_TIMEOUT_MS = 6_000;
const EXPLORE_MODEL = "claude-sonnet-4-6";

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

function timeLeft(deadlineAt, reserveMs = 1500) {
  return Math.max(0, deadlineAt - Date.now() - reserveMs);
}

function timeoutMessage(topic) {
  return `Research for "${topic}" reached the time limit before fresh opportunities could be saved. The progress log is preserved, and you can try again with a narrower query.`;
}

async function withTimeout(promise, ms, fallback) {
  if (ms <= 0) return fallback;
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise.catch(() => fallback), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function handleExplore(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const deadlineAt = Date.now() + EXPLORE_DEADLINE_MS;
  let terminalSent = false;
  let currentTopic = "this query";

  const send = async (event, data) => {
    try {
      if (res.writableEnded) return;
      const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      if (!res.write(chunk)) await new Promise((resolve) => res.once("drain", resolve));
    } catch {}
  };

  const sendDone = async (data) => {
    if (terminalSent) return;
    terminalSent = true;
    await send("done", data);
  };

  const sendError = async (message) => {
    if (terminalSent) return;
    terminalSent = true;
    await send("error", { message });
  };

  try {
    const body = await readBody(req);
    const topic = (body.topic ?? "").trim().slice(0, 120);
    currentTopic = topic || currentTopic;
    if (!topic) {
      await sendError("topic is required");
      return;
    }

    const apifyToken = process.env.APIFY_TOKEN;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!apifyToken || !anthropicKey) {
      await sendError("Missing API keys");
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

    await send("status", {
      message: `Searching Google, Quora, and LinkedIn for "${topic}" complaints…`,
    });
    const googleQueries = [
      `site:quora.com "${topic}" problem frustrated`,
      `site:quora.com "${topic}" "I wish there was"`,
      `site:linkedin.com/pulse "${topic}" challenges pain`,
      `"${topic}" painful problems tool missing`,
      `"${topic}" software complaint frustrated users`,
    ];

    const googleItems = await withTimeout(
      (async () => {
        const run = await apify.actor("apify/google-search-scraper").call(
          {
            queries: googleQueries.join("\n"),
            maxPagesPerQuery: 1,
            resultsPerPage: 10,
            countryCode: "us",
          },
          { waitSecs: 20 },
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
      Math.min(GOOGLE_TIMEOUT_MS, timeLeft(deadlineAt)),
      [],
    );

    await send("status", { message: `Checking X for "${topic}" pain points…` });
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const twitterQueries = [
      `"${topic}" "wish there was" since:${since} -is:retweet lang:en`,
      `"${topic}" frustrated problems since:${since} -is:retweet lang:en`,
      `"${topic}" "someone should build" since:${since} -is:retweet lang:en`,
    ];
    const twitterItems = await withTimeout(
      (async () => {
        const run = await apify
          .actor("apidojo/tweet-scraper")
          .call(
            { searchTerms: twitterQueries, maxItems: 40, queryType: "Top", lang: "en" },
            { waitSecs: 10 },
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
      Math.min(TWITTER_TIMEOUT_MS, timeLeft(deadlineAt)),
      [],
    );

    const raw = [...googleItems, ...twitterItems];

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
      await send("status", {
        message: `No fresh web signals found for "${topic}".`,
      });
      await sendDone({
        opportunities: [],
        topic,
        empty: true,
        message: `No fresh web research results were found for "${topic}". Saved feed results were not substituted.`,
      });
      return;
    }

    if (timeLeft(deadlineAt, CLAUDE_TIMEOUT_MS + 2000) <= 0) {
      await sendDone({
        opportunities: [],
        topic,
        empty: true,
        message: timeoutMessage(topic),
      });
      return;
    }

    await send("status", { message: `Analyzing ${filtered.length} signals with AI…` });

    const allOpps = [];
    const BATCH = 18;
    for (let i = 0; i < filtered.length; i += BATCH) {
      if (timeLeft(deadlineAt, 3000) <= 0) break;
      const batch = filtered.slice(i, i + BATCH);
      const userContent = batch
        .map(
          (item, idx) =>
            `[${idx + 1}] Platform: ${item.platform}\nTitle: ${item.title}\nContent: ${item.content.slice(0, 500)}\nURL: ${item.url}`,
        )
        .join("\n\n---\n\n");
      try {
        const msg = await withTimeout(
          anthropic.messages.create({
            model: EXPLORE_MODEL,
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Extract startup opportunities from these ${batch.length} posts:\n\n${userContent}`,
              },
            ],
          }),
          Math.min(CLAUDE_TIMEOUT_MS, timeLeft(deadlineAt, 2000)),
          null,
        );
        if (!msg) continue;
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
      await send("status", {
        message: `AI found no new structured opportunities for "${topic}".`,
      });
      await sendDone({
        opportunities: [],
        topic,
        empty: true,
        message: `The web scrapers found signals for "${topic}", but AI could not extract a structured startup opportunity. Saved feed results were not substituted.`,
      });
      return;
    }

    if (timeLeft(deadlineAt, SAVE_TIMEOUT_MS + 1000) <= 0) {
      await sendDone({
        opportunities: [],
        topic,
        empty: true,
        message: timeoutMessage(topic),
      });
      return;
    }

    await send("status", { message: `Saving ${allOpps.length} opportunities to feed…` });

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

    await withTimeout(
      supabase
        .from("opportunities")
        .upsert(rows, { onConflict: "dedup_hash", ignoreDuplicates: true })
        .select("id"),
      Math.min(SAVE_TIMEOUT_MS, timeLeft(deadlineAt)),
      null,
    );

    const hashes = rows.map((r) => r.dedup_hash);
    const saved = await withTimeout(
      supabase
        .from("opportunities")
        .select("*")
        .in("dedup_hash", hashes)
        .then(({ data }) => data),
      Math.min(SAVE_TIMEOUT_MS, timeLeft(deadlineAt)),
      null,
    );

    if (!saved?.length) {
      await sendDone({
        opportunities: [],
        topic,
        empty: true,
        message: `Research found possible signals for "${topic}", but could not save them before the request ended. Try again with a narrower query.`,
      });
      return;
    }

    await sendDone({ opportunities: saved, topic });
  } catch (err) {
    await sendError(err instanceof Error ? err.message : String(err));
  } finally {
    if (!terminalSent) {
      await sendDone({
        opportunities: [],
        topic: currentTopic,
        empty: true,
        message:
          "Research ended before a final result was returned. The progress log is preserved, and you can try again with a narrower query.",
      });
    }
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
