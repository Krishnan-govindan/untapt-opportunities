import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Prototype = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  deployed_url: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/built")({
  component: Built,
});

function Built() {
  const [items, setItems] = useState<Prototype[] | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      supabase
        .from("prototypes")
        .select("id,name,thumbnail_url,deployed_url,status,created_at")
        .order("created_at", { ascending: false })
        .then(({ data: rows }) => setItems((rows ?? []) as Prototype[]));
    });
  }, []);

  if (authed === false) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to see prototypes you've built.
        </p>
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Built</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prototypes you've generated.
        </p>
      </header>

      {items === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton-violet h-40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No prototypes yet.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Browse opportunities
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div
              key={p.id}
              className="glow-hover overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-primary/15 to-primary-glow/10">
                <span className="font-mono text-xs text-muted-foreground">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="p-4">
                <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                {p.deployed_url ? (
                  <a
                    href={p.deployed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate font-mono text-xs text-primary hover:underline"
                  >
                    {p.deployed_url}
                  </a>
                ) : (
                  <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {p.status}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
