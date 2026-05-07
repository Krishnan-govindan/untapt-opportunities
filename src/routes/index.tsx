import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CardSkeleton } from "@/components/CardSkeleton";
import { LiveCounter } from "@/components/LiveCounter";
import { useAgent } from "@/lib/agent-context";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

const PAGE_SIZE = 12;

type Filter = "all" | "hot" | "urgent" | "big_tam";

const FILTERS: { id: Filter; emoji: string; label: string }[] = [
  { id: "all",     emoji: "✦",  label: "All"      },
  { id: "hot",     emoji: "🔥", label: "Hot"      },
  { id: "urgent",  emoji: "⚡", label: "Urgent"   },
  { id: "big_tam", emoji: "💰", label: "Big Market" },
];

function buildQuery(query: string, filter: Filter) {
  let q = supabase.from("opportunities").select("*");

  if (query.trim()) {
    q = q.or(
      `title.ilike.%${query.trim()}%,pain_summary.ilike.%${query.trim()}%`
    );
  }

  if (filter === "hot")     q = q.eq("is_hot", true);
  if (filter === "urgent")  q = q.gte("urgency_score", 8);
  if (filter === "big_tam") q = q.ilike("tam_estimate", "%B%");

  return q.order("is_hot", { ascending: false })
          .order("urgency_score", { ascending: false })
          .order("created_at", { ascending: false });
}

function Index() {
  const [items, setItems]       = useState<Opportunity[]>([]);
  const [loading, setLoading]   = useState(true);
  const [done, setDone]         = useState(false);
  const [counter, setCounter]   = useState(0);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery]       = useState("");
  const [filter, setFilter]     = useState<Filter>("all");
  const { setPageContext }       = useAgent();

  const offset        = useRef(0);
  const loadingMore   = useRef(false);
  const sentinel      = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the raw input → committed query
  const handleQueryChange = (v: string) => {
    setRawQuery(v);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setQuery(v), 300);
  };

  const clearSearch = () => {
    setRawQuery("");
    setQuery("");
  };

  const loadMore = useCallback(
    async (reset = false, q = query, f = filter) => {
      if (!reset && (loadingMore.current || done)) return;
      loadingMore.current = true;

      const from = reset ? 0 : offset.current;
      const to   = from + PAGE_SIZE - 1;

      const { data, error } = await buildQuery(q, f).range(from, to);

      if (error) {
        toast.error("Couldn't load opportunities");
      } else if (data) {
        setItems((p) => (reset ? (data as Opportunity[]) : [...p, ...(data as Opportunity[])]));
        offset.current = from + (data?.length ?? 0);
        if ((data?.length ?? 0) < PAGE_SIZE) setDone(true);
        else setDone(false);
      }
      setLoading(false);
      loadingMore.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, filter, done]
  );

  // Reset + reload when search or filter changes
  useEffect(() => {
    offset.current = 0;
    setDone(false);
    setLoading(true);
    setItems([]);
    loadMore(true, query, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter]);

  // Sync feed context to agent sidebar
  useEffect(() => {
    setPageContext({ type: "feed", query: query || undefined, filter: filter !== "all" ? filter : undefined });
  }, [query, filter, setPageContext]);

  // Initial total count
  useEffect(() => {
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => setCounter((count ?? 0) + 12847));
  }, []);

  // Live counter tick
  useEffect(() => {
    const i = setInterval(() => setCounter((c) => c + 1), 3000);
    return () => clearInterval(i);
  }, []);

  // Realtime inserts
  useEffect(() => {
    const ch = supabase
      .channel("opportunities-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "opportunities" },
        (payload) => {
          if (!query && filter === "all") {
            setItems((prev) => [payload.new as Opportunity, ...prev]);
          }
          setCounter((c) => c + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [query, filter]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, query, filter]);

  const skeletons = useMemo(
    () => Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />),
    [],
  );

  const isSearching = query.trim().length > 0 || filter !== "all";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center">
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          The startup opportunities{" "}
          <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            nobody's monetizing
          </span>{" "}
          yet.
        </h1>
        <p className="mt-4 max-w-xl text-balance text-sm text-muted-foreground">
          Scraped continuously from Reddit, X, Hacker News, and Product Hunt
          complaints. Ranked by urgency and TAM.
        </p>
        <div className="mt-8">
          <LiveCounter value={counter} />
        </div>
      </section>

      {/* ── Search + filters ── */}
      <section className="mx-auto mt-10 max-w-2xl">
        {/* Search input */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search ideas, problems, markets…"
            className="search-input w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {rawQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`filter-chip ${filter === f.id ? "filter-chip-active" : ""}`}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Feed ── */}
      <section className="mt-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {isSearching
              ? query
                ? `Results for "${query}"`
                : `${FILTERS.find((f) => f.id === filter)?.emoji} ${FILTERS.find((f) => f.id === filter)?.label}`
              : "Latest signals"}
          </h2>
          {!loading && (
            <span className="font-mono text-xs text-muted-foreground">
              {items.length} {isSearching ? "found" : "loaded"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading && items.length === 0
            ? skeletons
            : items.map((o) => (
                <div key={o.id} className="fade-in-up">
                  <OpportunityCard o={o} />
                </div>
              ))}
        </div>

        {/* No results */}
        {!loading && items.length === 0 && isSearching && (
          <div className="mt-20 flex flex-col items-center gap-3 text-center">
            <span className="text-4xl">🔍</span>
            <p className="text-sm text-muted-foreground">
              No opportunities matched{query ? ` "${query}"` : ""}. Try a broader term.
            </p>
            <button
              onClick={() => { clearSearch(); setFilter("all"); }}
              className="mt-1 rounded-md border border-border px-4 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {!done && (
          <div ref={sentinel} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.length > 0 && Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
          </div>
        )}
        {done && items.length > 0 && (
          <p className="mt-12 text-center font-mono text-xs text-muted-foreground">
            — end of feed —
          </p>
        )}
      </section>
    </main>
  );
}
