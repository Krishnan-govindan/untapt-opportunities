import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";

type SearchableOpportunity = Opportunity & {
  competitors?: unknown;
  dedup_hash?: string | null;
};

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;
const STOP_WORDS = new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "anything",
  "are",
  "find",
  "for",
  "from",
  "has",
  "have",
  "i",
  "in",
  "is",
  "it",
  "items",
  "look",
  "of",
  "on",
  "opportunity",
  "search",
  "that",
  "the",
  "then",
  "to",
  "with",
]);

function normalize(value: unknown): string {
  const text =
    Array.isArray(value) || (value && typeof value === "object")
      ? JSON.stringify(value)
      : String(value ?? "");

  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenVariants(token: string): string[] {
  const variants = new Set([token]);
  if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
  if (!token.endsWith("s") && token.length > 2) variants.add(`${token}s`);
  return [...variants];
}

function tokensFor(query: string): string[] {
  return normalize(query)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function fieldText(row: SearchableOpportunity, key: keyof SearchableOpportunity): string {
  return normalize(row[key]);
}

function textTokens(text: string): string[] {
  return text.split(" ").filter(Boolean);
}

function hasToken(tokens: Set<string>, token: string): boolean {
  return tokenVariants(token).some((variant) => tokens.has(variant));
}

function hasPhrase(text: string, phrase: string): boolean {
  const haystack = textTokens(text);
  const needle = textTokens(phrase);
  if (needle.length === 0 || needle.length > haystack.length) return false;

  for (let i = 0; i <= haystack.length - needle.length; i++) {
    const matches = needle.every((token, offset) =>
      tokenVariants(token).includes(haystack[i + offset]),
    );
    if (matches) return true;
  }

  return false;
}

function scoreOpportunity(row: SearchableOpportunity, query: string, tokens: string[]): number {
  const phrase = normalize(query);
  const weightedFields: Array<[string, number]> = [
    [fieldText(row, "title"), 8],
    [fieldText(row, "pain_summary"), 6],
    [fieldText(row, "pain_description"), 5],
    [fieldText(row, "icp"), 4],
    [fieldText(row, "why_now"), 4],
    [fieldText(row, "mvp_features"), 3],
    [fieldText(row, "competitors"), 2],
    [fieldText(row, "sources"), 2],
    [fieldText(row, "sources_detail"), 2],
    [fieldText(row, "tam_estimate"), 1],
  ];

  let score = 0;
  const haystack = weightedFields.map(([text]) => text).join(" ");
  const haystackTokens = new Set(textTokens(haystack));
  if (phrase && hasPhrase(haystack, phrase)) score += 40;

  for (const [text, weight] of weightedFields) {
    const tokensInField = new Set(textTokens(text));
    for (const token of tokens) {
      if (hasToken(tokensInField, token)) {
        score += weight;
      }
    }
  }

  const matchedTokenCount = tokens.filter((token) => hasToken(haystackTokens, token)).length;

  if (tokens.length === 1 && matchedTokenCount === 0) return 0;

  if (tokens.length > 1 && matchedTokenCount < Math.min(tokens.length, 2)) return 0;

  score += matchedTokenCount * matchedTokenCount;

  if (row.is_hot) score += 2;
  score += Math.max(0, row.urgency_score ?? 0) / 10;

  return score;
}

async function loadOpportunities(): Promise<SearchableOpportunity[]> {
  const rows: SearchableOpportunity[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    rows.push(...((data ?? []) as SearchableOpportunity[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

export const Route = createFileRoute("/api/explore/search")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").trim().slice(0, 240);
        const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

        if (!query) {
          return new Response(JSON.stringify({ opportunities: [], query, totalScanned: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const tokens = tokensFor(query);
          const rows = await loadOpportunities();
          const scored = rows
            .map((row) => ({ row, score: scoreOpportunity(row, query, tokens) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ row, score }) => ({ ...row, search_score: Number(score.toFixed(2)) }));

          return new Response(
            JSON.stringify({ opportunities: scored, query, totalScanned: rows.length }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Search failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
