import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useAgent } from "@/lib/agent-context";

export const Route = createFileRoute("/explore")({
  component: Explore,
});

type Phase =
  | { kind: "idle" }
  | { kind: "running"; mode: "saved" | "research"; messages: string[] }
  | {
      kind: "done";
      mode: "saved" | "research";
      opportunities: Opportunity[];
      topic: string;
      totalScanned?: number;
    }
  | { kind: "error"; message: string };

function agentOpportunities(opportunities: Opportunity[]) {
  return opportunities.slice(0, 8).map((o) => ({
    id: o.id,
    title: o.title,
    pain_summary: o.pain_summary,
    icp: o.icp,
    tam_estimate: o.tam_estimate,
    urgency_score: o.urgency_score,
    why_now: o.why_now,
    mvp_features: o.mvp_features,
    pain_description: o.pain_description,
    sources: o.sources,
    sources_detail: o.sources_detail,
    competitors: o.competitors,
  }));
}

function Explore() {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const { setOpen, setPageContext } = useAgent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    await searchSaved(trimmed);
  };

  const searchSaved = async (query: string) => {
    setPhase({
      kind: "running",
      mode: "saved",
      messages: ["Searching every saved opportunity field…"],
    });

    try {
      const params = new URLSearchParams({ q: query, limit: "36" });
      const res = await fetch(`/api/explore/search?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        opportunities?: Opportunity[];
        totalScanned?: number;
        error?: string;
      };

      if (!res.ok) {
        setPhase({ kind: "error", message: data.error ?? "Search failed" });
        return;
      }

      setPhase({
        kind: "done",
        mode: "saved",
        opportunities: data.opportunities ?? [],
        topic: query,
        totalScanned: data.totalScanned,
      });
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  const runResearch = async (query = topic.trim()) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setTopic(trimmed);
    setPhase({ kind: "running", mode: "research", messages: ["Starting web research…"] });

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setPhase({ kind: "error", message: (err as { error: string }).error });
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const dec = new TextDecoder();
      let buf = "";
      let currentEvent = "";

      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch {
          break;
        }
        const { done, value } = result;
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (currentEvent === "status") {
                setPhase((prev) =>
                  prev.kind === "running"
                    ? {
                        kind: "running",
                        mode: prev.mode,
                        messages: [...prev.messages, data.message as string],
                      }
                    : prev,
                );
              } else if (currentEvent === "done") {
                setPhase({
                  kind: "done",
                  mode: "research",
                  opportunities: data.opportunities as Opportunity[],
                  topic: data.topic as string,
                });
              } else if (currentEvent === "error") {
                setPhase({
                  kind: "error",
                  message: data.message as string,
                });
              }
            } catch {
              /* malformed line */
            }
            currentEvent = "";
          }
        }
      }
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      readerRef.current = null;
    }
  };

  useEffect(() => {
    if (phase.kind === "done") {
      setPageContext({
        type: "explore",
        query: phase.topic,
        mode: phase.mode,
        resultCount: phase.opportunities.length,
        opportunities: agentOpportunities(phase.opportunities),
      });
      return;
    }

    if (topic.trim()) {
      setPageContext({ type: "explore", query: topic.trim() });
    } else {
      setPageContext({ type: "explore" });
    }
  }, [phase, setPageContext, topic]);

  const isRunning = phase.kind === "running";

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Explore pain points in any market
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
          Search all saved opportunities by idea, customer, source, competitor, MVP feature, or
          plain-language thesis. Then ask the agent to research the companies and angles behind what
          you find.
        </p>
      </div>

      {/* ── Search form ──────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="mb-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. dental billing software, HR onboarding, B2B invoicing tools…"
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isRunning || !topic.trim()}
            className="rounded-xl bg-gradient-to-r from-primary to-primary-glow px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Spinner />
                {phase.kind === "running" && phase.mode === "research"
                  ? "Researching…"
                  : "Searching…"}
              </span>
            ) : (
              "Search all items →"
            )}
          </button>
        </div>
      </form>

      {/* ── Progress ─────────────────────────────────────────────────── */}
      {phase.kind === "running" && (
        <div className="mb-10 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Spinner size="lg" />
            <span className="font-mono text-sm text-foreground">
              {phase.messages[phase.messages.length - 1]}
            </span>
          </div>
          {phase.messages.length > 1 && (
            <div className="space-y-1 border-t border-border pt-4">
              {phase.messages.slice(0, -1).map((msg, i) => (
                <p key={i} className="font-mono text-[11px] text-muted-foreground">
                  ✓ {msg}
                </p>
              ))}
            </div>
          )}
          <p className="mt-4 font-mono text-[10px] text-muted-foreground/60">
            {phase.mode === "research"
              ? "Scraping X, Quora, and LinkedIn — this takes 3–5 minutes…"
              : "Scanning titles, pain, ICP, competitors, features, sources, and source snippets…"}
          </p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {phase.kind === "error" && (
        <div className="mb-10 rounded-xl border border-destructive/40 bg-destructive/10 p-6">
          <p className="text-sm font-medium text-destructive">{phase.message}</p>
          <button
            onClick={() => setPhase({ kind: "idle" })}
            className="mt-3 text-xs text-muted-foreground underline hover:text-foreground"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {phase.kind === "done" && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {phase.opportunities.length} opportunit
                {phase.opportunities.length === 1 ? "y" : "ies"} found
              </h2>
              <p className="text-sm text-muted-foreground">
                {phase.mode === "saved"
                  ? `for “${phase.topic}” across ${phase.totalScanned ?? "saved"} items`
                  : `for “${phase.topic}” — now live on the feed`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase({ kind: "idle" })}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Search again
              </button>
              <button
                onClick={() => runResearch(phase.topic)}
                disabled={isRunning}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary disabled:opacity-50"
              >
                Research web
              </button>
              <button
                onClick={() => {
                  setOpen(true);
                  setPageContext({
                    type: "explore",
                    query: phase.topic,
                    mode: phase.mode,
                    resultCount: phase.opportunities.length,
                    opportunities: agentOpportunities(phase.opportunities),
                  });
                }}
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Ask agent
              </button>
              <Link
                to="/"
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary"
              >
                ← View all on feed
              </Link>
            </div>
          </div>

          {phase.opportunities.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No saved opportunities matched this search. Run web research to collect fresh signals
              for this thesis.
              <div className="mt-4">
                <button
                  onClick={() => runResearch(phase.topic)}
                  className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/15"
                >
                  Research web
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {phase.opportunities.map((o) => (
                <OpportunityCard key={o.id} o={o} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {phase.kind === "idle" && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-2xl mb-3">🔍</p>
          <p className="text-sm text-muted-foreground">
            Enter anything above to search every saved opportunity
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              "sell data to labs",
              "dental billing",
              "HR onboarding",
              "freight logistics",
              "legal discovery",
              "school admin",
            ].map((ex) => (
              <button
                key={ex}
                onClick={() => setTopic(ex)}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <svg
      className={`${cls} animate-spin text-primary`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
