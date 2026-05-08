import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth, useRequireAuth } from "@/lib/require-auth";
import { GuestEmailDialog } from "@/components/GuestEmailDialog";

export const Route = createFileRoute("/my-businesses")({
  beforeLoad: async () => { await requireAuth("/my-businesses"); },
  component: MyBusinessesPage,
});

type Prototype = {
  id: string;
  name: string;
  status: string;
  thumbnail_url: string | null;
  deployed_url: string | null;
  created_at: string;
  opportunity_id: string;
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "Recently";
  }
}

function statusStyle(status: string) {
  const map: Record<string, string> = {
    deployed: "border-green-500/40 bg-green-500/10 text-green-400",
    deploying: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    designing: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    branding: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    strategizing: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    researching: "border-border bg-secondary text-muted-foreground",
    failed: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return map[status] ?? "border-border bg-secondary text-muted-foreground";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function PrototypeCard({ proto }: { proto: Prototype }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors p-5 gap-4">
      {/* Avatar */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-sm font-bold text-primary-foreground">
        {initials(proto.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{proto.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(proto.created_at)}</p>
        <span
          className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle(proto.status)}`}
        >
          {proto.status}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Link
          to="/demo/$id"
          params={{ id: proto.opportunity_id }}
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          View demo
        </Link>
        {proto.deployed_url && (
          <a
            href={proto.deployed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            View live ↗
          </a>
        )}
      </div>
    </div>
  );
}

function MyBusinessesPage() {
  const { loading: authLoading, user, isGuest, guestId, guestEmail, setGuestEmail } =
    useRequireAuth("/my-businesses");
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      supabase
        .from("prototypes")
        .select("id, name, status, thumbnail_url, deployed_url, created_at, opportunity_id")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) toast.error("Couldn't load prototypes");
          else setPrototypes((data ?? []) as Prototype[]);
          setLoading(false);
        });
      return;
    }

    if (isGuest && guestId && guestEmail) {
      fetch(`/api/guest/prototypes?${new URLSearchParams({ guest_id: guestId, email: guestEmail })}`)
        .then((res) => res.json())
        .then((data: { prototypes?: Prototype[]; error?: string }) => {
          if (data.error) toast.error(data.error);
          setPrototypes(data.prototypes ?? []);
          setLoading(false);
        })
        .catch(() => {
          toast.error("Couldn't load guest prototypes");
          setLoading(false);
        });
      return;
    }

    if (isGuest) {
      setLoading(false);
      setEmailDialogOpen(true);
    }
  }, [authLoading, guestEmail, guestId, isGuest, user]);

  if (authLoading || (!user && !isGuest)) {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
        <div className="text-sm text-muted-foreground">Redirecting to sign in...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">My Businesses</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Every prototype and startup demo you've built — your personal portfolio of ideas in
          motion.
        </p>
        {isGuest && (
          <button
            onClick={() => setEmailDialogOpen(true)}
            className="mt-4 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/15 transition-colors"
          >
            {guestEmail ? `Guest: ${guestEmail}` : "Add email to load guest businesses"}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Grid */}
      {!loading && prototypes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {prototypes.map((p) => (
            <PrototypeCard key={p.id} proto={p} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && prototypes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <p className="mb-2 text-3xl">🚀</p>
          <p className="text-lg font-semibold text-foreground">No businesses built yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Head to Studio to capture your ideas, do market research, and launch your first
            prototype.
          </p>
          <Link
            to="/studio"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-primary to-primary-glow px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Go to Studio →
          </Link>
        </div>
      )}
      <GuestEmailDialog
        open={emailDialogOpen}
        initialEmail={guestEmail}
        title="Find your guest businesses"
        description="Enter the email you used for guest mode so we can show prototypes linked to it."
        onOpenChange={setEmailDialogOpen}
        onSubmit={(email) => {
          setGuestEmail(email);
          setLoading(true);
        }}
      />
    </main>
  );
}
