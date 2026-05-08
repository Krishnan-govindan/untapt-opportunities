import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useAgent } from "@/lib/agent-context";
import { useAuth } from "@/lib/auth-context";
import { GuestEmailDialog } from "@/components/GuestEmailDialog";

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
      message?: string;
      empty?: boolean;
    }
  | { kind: "error"; message: string };

type ExploreHistoryEntry = {
  id: string;
  topic: string;
  mode: "saved" | "research";
  opportunities: Opportunity[];
  totalScanned?: number;
  messages: string[];
  message?: string;
  empty?: boolean;
  createdAt: string;
};

const HISTORY_KEY = "untapt-explore-history:v2";
const EMAIL_PROMPT_KEY = "untapt-research-email-prompted:v1";
const GUEST_EMAIL_KEY = "untapt-guest-email:v1";
const MAX_HISTORY = 50;

type PendingAction = { mode: "saved" | "research"; query: string };

type PublicResearchRun = {
  id: string;
  created_at: string;
  mode: "saved" | "research";
  topic: string;
  result_count: number;
  total_scanned: number | null;
  messages: unknown;
  message: string | null;
  empty: boolean;
  opportunities: unknown;
};

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readHistory(): ExploreHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExploreHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.topic === "string" &&
        Array.isArray(entry.opportunities),
    );
  } catch {
    return [];
  }
}

function formatHistoryDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Recent";
  }
}

function historyFromPublicRun(run: PublicResearchRun): ExploreHistoryEntry | null {
  if (!Array.isArray(run.opportunities)) return null;
  return {
    id: run.id,
    topic: run.topic,
    mode: run.mode,
    opportunities: run.opportunities as Opportunity[],
    totalScanned: run.total_scanned ?? undefined,
    messages: Array.isArray(run.messages)
      ? run.messages.filter((item): item is string => typeof item === "string")
      : [],
    message: run.message ?? undefined,
    empty: run.empty,
    createdAt: run.created_at,
  };
}

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
  const [history, setHistory] = useState<ExploreHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { setOpen, setPageContext } = useAgent();
  const { user, guestId, guestEmail, continueAsGuest, setGuestEmail } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function loadPublicHistory() {
      try {
        const res = await fetch("/api/research-history?limit=50");
        const data = (await res.json().catch(() => ({}))) as {
          history?: PublicResearchRun[];
        };
        if (!res.ok || !Array.isArray(data.history)) throw new Error("History unavailable");
        if (cancelled) return;
        setHistory(data.history.map(historyFromPublicRun).filter(Boolean) as ExploreHistoryEntry[]);
      } catch {
        if (!cancelled) setHistory(readHistory());
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    }

    void loadPublicHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!historyLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, historyLoaded]);

  useEffect(() => {
    if (!historyLoaded || !history.length || typeof window === "undefined") return;
    const match = window.location.hash.match(/^#research-(.+)$/);
    if (!match) return;
    const entry = history.find((item) => item.id === match[1]);
    if (entry) openHistoryEntry(entry, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded]);

  const getTrackingGuestId = () => user?.id ?? guestId ?? continueAsGuest() ?? createHistoryId();
  const getOwnerEmail = () =>
    user?.email ??
    guestEmail ??
    (typeof window !== "undefined" ? window.localStorage.getItem(GUEST_EMAIL_KEY) : null);

  const persistResult = async (localEntry: ExploreHistoryEntry) => {
    try {
      const res = await fetch("/api/research-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_id: getTrackingGuestId(),
          owner_email: getOwnerEmail(),
          mode: localEntry.mode,
          topic: localEntry.topic,
          total_scanned: localEntry.totalScanned ?? null,
          messages: localEntry.messages,
          message: localEntry.message ?? null,
          empty: Boolean(localEntry.empty),
          opportunities: localEntry.opportunities,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { run?: PublicResearchRun };
      const publicEntry = data.run ? historyFromPublicRun(data.run) : null;
      if (!res.ok || !publicEntry) throw new Error("Couldn't store research run");

      setHistory((prev) =>
        [publicEntry, ...prev.filter((item) => item.id !== localEntry.id)]
          .filter(
            (entry, index, all) =>
              all.findIndex(
                (item) =>
                  item.topic.trim().toLowerCase() === entry.topic.trim().toLowerCase() &&
                  item.mode === entry.mode &&
                  item.opportunities.map((o) => o.id).join("|") ===
                    entry.opportunities.map((o) => o.id).join("|"),
              ) === index,
          )
          .slice(0, MAX_HISTORY),
      );
      setActiveHistoryId((current) => (current === localEntry.id ? publicEntry.id : current));
      if (typeof window !== "undefined" && window.location.hash === `#research-${localEntry.id}`) {
        window.history.replaceState(null, "", `#research-${publicEntry.id}`);
      }
    } catch {
      // Keep the local cached run if public persistence is temporarily unavailable.
    }
  };

  const rememberResult = (
    entry: Omit<ExploreHistoryEntry, "id" | "createdAt">,
  ): ExploreHistoryEntry => {
    const next: ExploreHistoryEntry = {
      ...entry,
      id: createHistoryId(),
      createdAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      const topicKey = entry.topic.trim().toLowerCase();
      const resultKey = entry.opportunities.map((o) => o.id).join("|");
      const deduped = prev.filter((item) => {
        const sameTopic = item.topic.trim().toLowerCase() === topicKey;
        const sameMode = item.mode === entry.mode;
        const sameResults = item.opportunities.map((o) => o.id).join("|") === resultKey;
        return !(sameTopic && sameMode && sameResults);
      });
      return [next, ...deduped].slice(0, MAX_HISTORY);
    });

    setActiveHistoryId(next.id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#research-${next.id}`);
    }
    void persistResult(next);
    return next;
  };

  const executeStoredAction = async (action: PendingAction) => {
    if (action.mode === "saved") await searchSaved(action.query);
    else await runResearch(action.query);
  };

  const requestStoredAction = async (action: PendingAction) => {
    const shouldPrompt =
      !user?.email &&
      !guestEmail &&
      typeof window !== "undefined" &&
      window.localStorage.getItem(EMAIL_PROMPT_KEY) !== "true";

    if (shouldPrompt) {
      setPendingAction(action);
      setEmailDialogOpen(true);
      return;
    }

    getTrackingGuestId();
    await executeStoredAction(action);
  };

  const completePendingAction = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (typeof window !== "undefined") window.localStorage.setItem(EMAIL_PROMPT_KEY, "true");
    getTrackingGuestId();
    if (action) await executeStoredAction(action);
  };

  const openHistoryEntry = (entry: ExploreHistoryEntry, scroll = true) => {
    setTopic(entry.topic);
    setActiveHistoryId(entry.id);
    setPhase({
      kind: "done",
      mode: entry.mode,
      opportunities: entry.opportunities,
      topic: entry.topic,
      totalScanned: entry.totalScanned,
      message: entry.message,
      empty: entry.empty,
    });
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#research-${entry.id}`);
    }
    if (scroll) {
      window.requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    await requestStoredAction({ mode: "saved", query: trimmed });
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

      const opportunities = data.opportunities ?? [];
      setPhase({
        kind: "done",
        mode: "saved",
        opportunities,
        topic: query,
        totalScanned: data.totalScanned,
      });
      rememberResult({
        mode: "saved",
        topic: query,
        opportunities,
        totalScanned: data.totalScanned,
        messages: ["Searched saved opportunities"],
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
    let progressMessages = ["Starting web research…"];
    setPhase({ kind: "running", mode: "research", messages: progressMessages });

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
                const message = String(data.message ?? "Working…");
                progressMessages = [...progressMessages, message];
                setPhase((prev) =>
                  prev.kind === "running"
                    ? {
                        kind: "running",
                        mode: prev.mode,
                        messages: [...prev.messages, message],
                      }
                    : prev,
                );
              } else if (currentEvent === "done") {
                const opportunities = (data.opportunities as Opportunity[]) ?? [];
                const doneTopic = String(data.topic ?? trimmed);
                const message = typeof data.message === "string" ? data.message : undefined;
                const empty = data.empty === true || opportunities.length === 0;
                setPhase({
                  kind: "done",
                  mode: "research",
                  opportunities,
                  topic: doneTopic,
                  message,
                  empty,
                });
                rememberResult({
                  mode: "research",
                  topic: doneTopic,
                  opportunities,
                  messages: message ? [...progressMessages, message] : progressMessages,
                  message,
                  empty,
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
        <div ref={resultsRef}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {phase.opportunities.length} opportunit
                {phase.opportunities.length === 1 ? "y" : "ies"} found
              </h2>
              <p className="text-sm text-muted-foreground">
                {phase.mode === "saved"
                  ? `for “${phase.topic}” across ${phase.totalScanned ?? "saved"} items`
                  : phase.empty
                    ? `for “${phase.topic}” — no fresh web opportunities found`
                    : `for “${phase.topic}” — fresh web research`}
              </p>
              {phase.message && (
                <p className="mt-2 max-w-xl text-xs text-muted-foreground">{phase.message}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPhase({ kind: "idle" });
                  setActiveHistoryId(null);
                  if (typeof window !== "undefined") {
                    window.history.replaceState(null, "", window.location.pathname);
                  }
                }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Search again
              </button>
              <button
                onClick={() => requestStoredAction({ mode: "research", query: phase.topic })}
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
              {phase.mode === "research"
                ? "This web research run completed with no fresh opportunities. The run is stored in history below with its research log."
                : "No saved opportunities matched this search. Run web research to collect fresh signals for this thesis."}
              {phase.mode === "saved" && (
                <div className="mt-4">
                  <button
                    onClick={() => requestStoredAction({ mode: "research", query: phase.topic })}
                    className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/15"
                  >
                    Research web
                  </button>
                </div>
              )}
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

      <ExploreHistory
        history={history}
        activeHistoryId={activeHistoryId}
        onOpen={openHistoryEntry}
      />
      <GuestEmailDialog
        open={emailDialogOpen}
        initialEmail={guestEmail}
        title="Save this research?"
        description="Add an email if you want us to connect future research projects back to you. You can also skip and continue anonymously."
        skipLabel="Skip and continue"
        onOpenChange={setEmailDialogOpen}
        onSkip={() => {
          void completePendingAction();
        }}
        onSubmit={(email) => {
          setGuestEmail(email);
          void completePendingAction();
        }}
      />
    </main>
  );
}

function ExploreHistory({
  history,
  activeHistoryId,
  onOpen,
}: {
  history: ExploreHistoryEntry[];
  activeHistoryId: string | null;
  onOpen: (entry: ExploreHistoryEntry) => void;
}) {
  const activeEntry = history.find((entry) => entry.id === activeHistoryId) ?? history[0];

  return (
    <section className="mt-14 border-t border-border pt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Research history
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved searches and web research stay here so you can reopen the exact result set.
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-sm text-muted-foreground">
          Run a saved search or Research web. The full result set will be stored here.
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {history.map((entry) => {
              const selected = entry.id === activeEntry?.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => onOpen(entry)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selected
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {entry.mode === "research" ? "Web research" : "Saved search"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatHistoryDate(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{entry.topic}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.opportunities.length} opportunit
                        {entry.opportunities.length === 1 ? "y" : "ies"}
                        {entry.totalScanned ? ` across ${entry.totalScanned} scanned items` : ""}
                        {entry.empty ? " · no fresh results" : ""}
                      </p>
                      {entry.message && (
                        <p className="mt-1 text-xs text-muted-foreground">{entry.message}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-primary">
                      {selected ? "Showing below" : "Open results"}
                    </span>
                  </div>
                  {(entry.messages ?? []).length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(entry.messages ?? []).slice(-3).map((message, i) => (
                        <span
                          key={`${entry.id}-${i}`}
                          className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {message}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {activeEntry && (
            <div className="mt-8">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Stored {activeEntry.mode === "research" ? "research" : "results"} for &quot;
                    {activeEntry.topic}&quot;
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Click a history item above to swap this exact saved result set.
                  </p>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {activeEntry.opportunities.length} saved
                </span>
              </div>
              {activeEntry.opportunities.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/50 p-8 text-sm text-muted-foreground">
                  {activeEntry.message ??
                    "This run completed with no stored opportunities. Its research log is preserved in the history item above."}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeEntry.opportunities.map((o) => (
                    <OpportunityCard key={`${activeEntry.id}-${o.id}`} o={o} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
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
