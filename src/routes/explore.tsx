import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/OpportunityCard";

export const Route = createFileRoute("/explore")({
  component: Explore,
});

type Phase =
  | { kind: "idle" }
  | { kind: "running"; messages: string[] }
  | { kind: "done"; opportunities: Opportunity[]; topic: string }
  | { kind: "error"; message: string };

function Explore() {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setPhase({ kind: "running", messages: ["Starting search…"] });

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
                        messages: [...prev.messages, data.message as string],
                      }
                    : prev
                );
              } else if (currentEvent === "done") {
                setPhase({
                  kind: "done",
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

  const isRunning = phase.kind === "running";

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Explore pain points in any market
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
          Enter a niche, industry, or product category — we'll search X, Quora,
          and LinkedIn for real complaints and surface the best unmonetized
          opportunities.
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
                Analyzing…
              </span>
            ) : (
              "Analyze market →"
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
            Scraping X, Quora, and LinkedIn — this takes 3–5 minutes…
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
                for &ldquo;{phase.topic}&rdquo; — now live on the feed
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase({ kind: "idle" })}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Search again
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
              No opportunities were found. Try a more specific niche or
              different keywords.
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
            Enter a market above to discover unmonetized pain points
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
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
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
