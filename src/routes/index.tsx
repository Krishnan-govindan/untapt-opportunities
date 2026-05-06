import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CardSkeleton } from "@/components/CardSkeleton";
import { LiveCounter } from "@/components/LiveCounter";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

const PAGE_SIZE = 12;

function Index() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [counter, setCounter] = useState(0);
  const offset = useRef(0);
  const loadingMore = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = async () => {
    if (loadingMore.current || done) return;
    loadingMore.current = true;
    const from = offset.current;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .order("is_hot", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      toast.error("Couldn't load opportunities");
    } else if (data) {
      setItems((p) => [...p, ...(data as Opportunity[])]);
      offset.current += data.length;
      if (data.length < PAGE_SIZE) setDone(true);
    }
    setLoading(false);
    loadingMore.current = false;
  };

  useEffect(() => {
    loadMore();
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => setCounter((count ?? 0) + 12847));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live counter tick every 3s
  useEffect(() => {
    const i = setInterval(() => setCounter((c) => c + 1), 3000);
    return () => clearInterval(i);
  }, []);

  // Realtime new opportunities → bump counter & prepend
  useEffect(() => {
    const ch = supabase
      .channel("opportunities-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "opportunities" },
        (payload) => {
          setItems((prev) => [payload.new as Opportunity, ...prev]);
          setCounter((c) => c + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const skeletons = useMemo(
    () => Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />),
    [],
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
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

      <section className="mt-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Latest signals
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {items.length} loaded
          </span>
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
        {!done && (
          <div ref={sentinel} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.length > 0 && Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
          </div>
        )}
        {done && (
          <p className="mt-12 text-center font-mono text-xs text-muted-foreground">
            — end of feed —
          </p>
        )}
      </section>
    </main>
  );
}
