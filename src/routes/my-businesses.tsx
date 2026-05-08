import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth, useRequireAuth } from "@/lib/require-auth";
import { GuestEmailDialog } from "@/components/GuestEmailDialog";
import type { UserIdea } from "@/lib/types";

export const Route = createFileRoute("/my-businesses")({
  beforeLoad: async () => {
    await requireAuth("/my-businesses");
  },
  component: MyBusinessesPage,
});

type Prototype = {
  id: string;
  name: string;
  status: string;
  thumbnail_url: string | null;
  deployed_url: string | null;
  created_at: string;
  opportunity_id: string | null;
  source_type: "opportunity" | "idea" | string;
  source_idea_id: string | null;
};

type BusinessCardItem = {
  idea: UserIdea;
  prototype: Prototype | null;
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

function ideaMetrics(idea: UserIdea) {
  const signals = idea.research_results ?? [];
  const urgency = signals.length
    ? Math.max(...signals.map((signal) => signal.urgency_score ?? 0), 5)
    : 5;
  const tam =
    signals.find((signal) => signal.tam_estimate && signal.tam_estimate !== "TBD")?.tam_estimate ??
    "TBD";
  return { urgency, tam, signalCount: signals.length };
}

const ACTIVE_STATUSES = new Set([
  "researching",
  "strategizing",
  "branding",
  "designing",
  "deploying",
]);
const STALE_BUILD_MS = 30 * 60 * 1000;

function shouldShowPrototype(proto: Prototype) {
  if (proto.status === "failed") return false;
  if (proto.deployed_url) return true;
  if (!ACTIVE_STATUSES.has(proto.status)) return false;

  const createdAt = new Date(proto.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt < STALE_BUILD_MS;
}

function joinIdeasWithPrototypes(ideas: UserIdea[], prototypes: Prototype[]): BusinessCardItem[] {
  return ideas.map((idea) => ({
    idea,
    prototype:
      prototypes.find((prototype) => prototype.source_idea_id === idea.id && prototype.deployed_url) ??
      prototypes.find((prototype) => prototype.source_idea_id === idea.id) ??
      null,
  }));
}

function PrototypeCard({ proto }: { proto: Prototype }) {
  const canViewFeedDemo = proto.source_type !== "idea" && Boolean(proto.opportunity_id);

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
        {canViewFeedDemo && proto.opportunity_id && (
          <Link
            to="/demo/$id"
            params={{ id: proto.opportunity_id }}
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            View feed idea
          </Link>
        )}
        {proto.deployed_url && (
          <a
            href={proto.deployed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            Open app ↗
          </a>
        )}
        {!proto.deployed_url && ACTIVE_STATUSES.has(proto.status) && (
          <span className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Building…
          </span>
        )}
      </div>
    </div>
  );
}

function BusinessIdeaCard({ item }: { item: BusinessCardItem }) {
  const { idea, prototype } = item;
  const metrics = ideaMetrics(idea);

  return (
    <div className="glow-hover relative flex flex-col rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {idea.category}
        </span>
        {metrics.signalCount > 0 && (
          <span className="category-badge badge-multi">📡 Researched</span>
        )}
        {prototype?.deployed_url && <span className="category-badge badge-tam">🚀 Live</span>}
      </div>

      <h3 className="text-base font-semibold leading-snug text-foreground">{idea.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
        {idea.description || "Private business idea ready for research and prototyping."}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-foreground">{metrics.tam}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground">
            URG <span className="text-foreground">{metrics.urgency}</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground">
            {metrics.signalCount} signal{metrics.signalCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/business/$id"
          params={{ id: idea.id }}
          className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary"
        >
          View
        </Link>
        {prototype?.deployed_url && (
          <a
            href={prototype.deployed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
          >
            Open app ↗
          </a>
        )}
        {!prototype?.deployed_url && prototype && ACTIVE_STATUSES.has(prototype.status) && (
          <span className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Building…
          </span>
        )}
      </div>
    </div>
  );
}

function MyBusinessesPage() {
  const {
    loading: authLoading,
    user,
    isGuest,
    guestId,
    guestEmail,
    setGuestEmail,
  } = useRequireAuth("/my-businesses");
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [businesses, setBusinesses] = useState<BusinessCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      Promise.all([
        supabase.from("user_ideas").select("*").order("created_at", { ascending: false }),
        supabase
          .from("prototypes")
          .select(
            "id, name, status, thumbnail_url, deployed_url, created_at, opportunity_id, source_type, source_idea_id",
          )
          .order("created_at", { ascending: false }),
      ])
        .then(([ideasResult, prototypesResult]) => {
          if (ideasResult.error || prototypesResult.error) {
            toast.error("Couldn't load businesses");
            return;
          }
          const ideas = (ideasResult.data ?? []) as unknown as UserIdea[];
          const visiblePrototypes = ((prototypesResult.data ?? []) as Prototype[]).filter(
            shouldShowPrototype,
          );
          setPrototypes(visiblePrototypes);
          setBusinesses(joinIdeasWithPrototypes(ideas, visiblePrototypes));
          setLoading(false);
        })
        .catch(() => {
          toast.error("Couldn't load businesses");
          setLoading(false);
        });
      return;
    }

    if (isGuest && guestId) {
      const params = new URLSearchParams({ guest_id: guestId });
      if (guestEmail) params.set("email", guestEmail);
      Promise.all([
        fetch(`/api/guest/ideas?${params.toString()}`).then(
          (res) => res.json() as Promise<{ ideas?: UserIdea[]; error?: string }>,
        ),
        fetch(`/api/guest/prototypes?${params.toString()}`).then(
          (res) => res.json() as Promise<{ prototypes?: Prototype[]; error?: string }>,
        ),
      ])
        .then(([ideasData, prototypesData]) => {
          if (ideasData.error || prototypesData.error) {
            toast.error(ideasData.error ?? prototypesData.error ?? "Couldn't load guest businesses");
          }
          const visiblePrototypes = (prototypesData.prototypes ?? []).filter(shouldShowPrototype);
          setPrototypes(visiblePrototypes);
          setBusinesses(joinIdeasWithPrototypes(ideasData.ideas ?? [], visiblePrototypes));
          setLoading(false);
        })
        .catch(() => {
          toast.error("Couldn't load guest businesses");
          setLoading(false);
        });
      return;
    }

    if (isGuest) setLoading(false);
  }, [authLoading, guestEmail, guestId, isGuest, user]);

  if (authLoading || (!user && !isGuest)) {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
        <div className="text-sm text-muted-foreground">Preparing guest workspace...</div>
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
            {guestEmail ? `Guest: ${guestEmail}` : "Add email to link guest businesses"}
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
      {!loading && (businesses.length > 0 || prototypes.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {businesses.map((item) => (
            <BusinessIdeaCard key={item.idea.id} item={item} />
          ))}
          {prototypes.filter((p) => !p.source_idea_id).map((p) => (
            <PrototypeCard key={p.id} proto={p} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && businesses.length === 0 && prototypes.length === 0 && (
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
        description="Enter the email you used for guest mode, or skip to show anonymous projects linked to this browser."
        skipLabel="Skip for now"
        onOpenChange={setEmailDialogOpen}
        onSkip={() => {
          setLoading(true);
          setLoading(false);
        }}
        onSubmit={(email) => {
          setGuestEmail(email);
          setLoading(true);
        }}
      />
    </main>
  );
}
