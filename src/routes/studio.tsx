import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { requireAuth, useRequireAuth } from "@/lib/require-auth";
import { useAgent } from "@/lib/agent-context";
import type { UserIdea, IdeaFile, Opportunity } from "@/lib/types";
import { IDEA_CATEGORIES } from "@/lib/types";
import { OpportunityCard } from "@/components/OpportunityCard";
import { BuildPrototypeModal } from "@/components/BuildPrototypeModal";
import { GuestEmailDialog } from "@/components/GuestEmailDialog";

export const Route = createFileRoute("/studio")({
  beforeLoad: async () => {
    await requireAuth("/studio");
  },
  component: StudioPage,
});

function ideaToOpportunity(idea: UserIdea): Opportunity {
  return {
    id: idea.id,
    title: idea.title,
    pain_summary: idea.description.slice(0, 200) || idea.title,
    pain_description: idea.description || idea.title,
    icp: `Entrepreneurs building in ${idea.category}`,
    sources: [],
    tam_estimate: "TBD",
    urgency_score: 5,
    competitors: [],
    why_now: "",
    mvp_features: [],
    is_hot: false,
    created_at: idea.created_at,
  };
}

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

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    "Market Research": "border-blue-500/40 bg-blue-500/10 text-blue-400",
    "SaaS Idea": "border-primary/40 bg-primary/10 text-primary",
    "Side Project": "border-green-500/40 bg-green-500/10 text-green-400",
    Agency: "border-orange-500/40 bg-orange-500/10 text-orange-400",
    Marketplace: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    "Consumer App": "border-pink-500/40 bg-pink-500/10 text-pink-400",
  };
  return map[cat] ?? "border-border bg-secondary text-muted-foreground";
}

function competitorPricing(competitor: Opportunity["competitors"][number]): string {
  return competitor.pricing ?? competitor.pricing_hint ?? "Pricing unknown";
}

function uniqueStrings(items: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const value = item?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function synthesizedResearch(idea: UserIdea) {
  const signals = idea.research_results ?? [];
  const topSignal = signals[0];
  const sourceDetails = signals.flatMap((signal) => signal.sources_detail ?? []).slice(0, 5);
  const competitors = signals
    .flatMap((signal) => signal.competitors ?? [])
    .filter((competitor) => competitor.name)
    .slice(0, 5);
  const mvpFeatures = uniqueStrings(
    [
      ...signals.flatMap((signal) => signal.mvp_features ?? []),
      "Capture the core user workflow in one focused product surface",
      "Track the highest-friction task from intake to resolution",
      "Create a simple dashboard for early customer validation",
    ],
    6,
  );
  const urgencyScore =
    signals.length > 0 ? Math.max(...signals.map((signal) => signal.urgency_score ?? 0), 5) : 5;
  const tamEstimate =
    signals.find((signal) => signal.tam_estimate && signal.tam_estimate !== "TBD")?.tam_estimate ??
    "TBD";

  return {
    signalCount: signals.length,
    tamEstimate,
    urgencyScore,
    icp:
      topSignal?.icp ??
      `Founders, operators, and early adopters validating ${idea.category.toLowerCase()} workflows.`,
    painDescription:
      idea.description ||
      topSignal?.pain_description ||
      `The idea needs sharper validation around the buyer, pain intensity, and first workflow.`,
    whyNow:
      topSignal?.why_now ??
      "The fastest path is to validate this as a narrow prototype, then use customer conversations to decide whether it deserves a larger build.",
    competitors,
    mvpFeatures,
    sourceDetails,
  };
}

function ResearchBrief({ idea }: { idea: UserIdea }) {
  const research = synthesizedResearch(idea);
  const signals = idea.research_results ?? [];

  return (
    <div className="col-span-full mt-0 rounded-2xl border border-primary/30 bg-card/70 p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Research brief
          </p>
          <h4 className="mt-1 text-lg font-semibold text-foreground">{idea.title}</h4>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            This is the research summary for your idea. The cards below are market signals we found,
            not businesses added to your portfolio.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2">
            <p className="font-mono text-sm text-foreground">{research.tamEstimate}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">TAM</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2">
            <p className="font-mono text-sm text-foreground">{research.urgencyScore}/10</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Urgency
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2">
            <p className="font-mono text-sm text-foreground">{research.signalCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Signals
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ICP
            </p>
            <p className="text-sm leading-relaxed text-foreground">{research.icp}</p>
          </section>
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pain description
            </p>
            <p className="text-sm leading-relaxed text-foreground">{research.painDescription}</p>
          </section>
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Why now
            </p>
            <p className="text-sm leading-relaxed text-foreground">{research.whyNow}</p>
          </section>
        </div>

        <div className="space-y-5">
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Suggested MVP features
            </p>
            <ul className="space-y-1.5">
              {research.mvpFeatures.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm text-foreground">
                  <span className="text-primary">▸</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {research.competitors.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Competitors
              </p>
              <ul className="space-y-2">
                {research.competitors.map((competitor) => (
                  <li
                    key={competitor.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{competitor.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {competitorPricing(competitor)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {research.sourceDetails.length > 0 && (
        <section className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sources
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {research.sourceDetails.map((source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                <span className="font-mono uppercase tracking-wider text-primary">
                  {source.platform}
                </span>
                <span className="mt-1 block line-clamp-2">{source.snippet || source.url}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {signals.length > 0 && (
        <section className="mt-6 border-t border-border pt-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Supporting market signals
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open any signal to inspect the full research page behind it.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map((o) => (
              <OpportunityCard key={o.id} o={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── New Idea Form ─────────────────────────────────────────────────────────────

function NewIdeaForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (draft: {
    title: string;
    description: string;
    category: string;
    video_url: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(IDEA_CATEGORIES[0]);
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      video_url: videoUrl.trim() || null,
    });
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 rounded-2xl border border-primary/30 bg-card p-6 space-y-4"
    >
      <h3 className="font-semibold text-foreground">New idea</h3>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Idea title (required)"
        required
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your idea — the problem it solves, who it's for, how it works…"
        rows={4}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {IDEA_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Video URL (optional — YouTube, Loom…)"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save idea"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  userId,
  ownerEmail,
  guestId,
  isGuest,
  onNeedEmail,
  onUpdate,
  onDelete,
}: {
  idea: UserIdea;
  userId: string | null;
  ownerEmail: string | null;
  guestId: string | null;
  isGuest: boolean;
  onNeedEmail: () => void;
  onUpdate: (updated: UserIdea) => void;
  onDelete: (id: string) => void;
}) {
  const { setOpen, setPageContext } = useAgent();
  const [researching, setResearching] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isGuest || !userId) {
      toast.error("Sign in to upload files");
      return;
    }
    setUploadingFile(true);
    const path = `${userId}/${idea.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("user-files").upload(path, file);
    if (error) {
      toast.error(error.message);
      setUploadingFile(false);
      return;
    }
    const newFile: IdeaFile = { name: file.name, path, size: file.size, type: file.type };
    const newFiles = [...idea.files, newFile];
    const { error: updateErr } = await supabase
      .from("user_ideas")
      .update({ files: newFiles as unknown as Json })
      .eq("id", idea.id);
    if (!updateErr) {
      onUpdate({ ...idea, files: newFiles });
      toast.success("File uploaded");
    } else {
      toast.error(updateErr.message);
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = async (filePath: string) => {
    if (isGuest) return;
    await supabase.storage.from("user-files").remove([filePath]);
    const newFiles = idea.files.filter((f) => f.path !== filePath);
    await supabase
      .from("user_ideas")
      .update({ files: newFiles as unknown as Json })
      .eq("id", idea.id);
    onUpdate({ ...idea, files: newFiles });
  };

  const handleResearch = async () => {
    if (isGuest && !guestId) {
      onNeedEmail();
      return;
    }

    setResearching(true);
    const q = `${idea.title} ${idea.description}`.slice(0, 200).trim();
    try {
      const res = await fetch(`/api/explore/search?${new URLSearchParams({ q, limit: "6" })}`);
      const data = (await res.json()) as { opportunities?: Opportunity[]; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Research failed");
        return;
      }
      const results = data.opportunities ?? [];
      if (isGuest) {
        const updateRes = await fetch("/api/guest/ideas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: idea.id,
            owner_email: ownerEmail,
            guest_id: guestId,
            research_results: results as unknown as Json,
          }),
        });
        if (!updateRes.ok)
          throw new Error("Research saved locally, but couldn't update guest idea");
      } else {
        await supabase
          .from("user_ideas")
          .update({ research_results: results as unknown as Json })
          .eq("id", idea.id);
      }
      onUpdate({ ...idea, research_results: results });
      setResearchOpen(true);
      toast.success(`Research brief ready with ${results.length} market signals`);
    } catch {
      toast.error("Research failed — check your connection");
    } finally {
      setResearching(false);
    }
  };

  const handleChatAbout = () => {
    setOpen(true);
    const researchContext = (idea.research_results ?? []).slice(0, 8) as Opportunity[];
    setPageContext({
      type: "explore",
      query: [
        idea.title,
        idea.description,
        `Category: ${idea.category}`,
        idea.video_url ? `Video: ${idea.video_url}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      mode: "saved",
      resultCount: researchContext.length,
      opportunities: researchContext,
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${idea.title}"?`)) return;
    setDeleting(true);
    if (!isGuest && idea.files.length > 0) {
      await supabase.storage.from("user-files").remove(idea.files.map((f) => f.path));
    }
    if (isGuest) {
      if (!ownerEmail || !guestId) {
        onNeedEmail();
        setDeleting(false);
        return;
      }
      await fetch("/api/guest/ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea.id, owner_email: ownerEmail, guest_id: guestId }),
      });
    } else {
      await supabase.from("user_ideas").delete().eq("id", idea.id);
    }
    onDelete(idea.id);
  };

  return (
    <>
      <div className="flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors">
        {/* Card header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground leading-tight truncate" title={idea.title}>
              {idea.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(idea.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColor(idea.category)}`}
            >
              {idea.category}
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              title="Delete idea"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Description */}
        {idea.description && (
          <p className="px-5 pb-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {idea.description}
          </p>
        )}

        {/* Video URL */}
        {idea.video_url && (
          <div className="px-5 pb-3">
            <a
              href={idea.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-80"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch video
            </a>
          </div>
        )}

        {/* Files */}
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-2">
            {idea.files.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <path d="M13 2v7h7" />
                </svg>
                <span className="max-w-[100px] truncate">{f.name}</span>
                {!isGuest && (
                  <button
                    onClick={() => handleRemoveFile(f.path)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {isGuest ? (
              <span className="rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
                Sign in to upload files
              </span>
            ) : (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
                {uploadingFile ? "Uploading…" : "+ Attach file"}
              </label>
            )}
          </div>
        </div>

        {/* Research results toggle */}
        {idea.research_results && idea.research_results.length > 0 && (
          <div className="border-t border-border px-5 py-2">
            <button
              onClick={() => setResearchOpen((o) => !o)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>
                Research brief ready · {idea.research_results.length} market signal
                {idea.research_results.length === 1 ? "" : "s"}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${researchOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-auto border-t border-border px-5 py-3 flex flex-wrap gap-2">
          <button
            onClick={handleResearch}
            disabled={researching}
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
          >
            {researching ? (
              <span className="flex items-center gap-1.5">
                <Spinner /> Researching…
              </span>
            ) : (
              "Research market"
            )}
          </button>
          <button
            onClick={() => {
              if (isGuest && !guestId) {
                onNeedEmail();
                return;
              }
              setBuildOpen(true);
            }}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            Build prototype
          </button>
          <button
            onClick={handleChatAbout}
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            Chat about it
          </button>
        </div>
      </div>

      {/* Research brief panel */}
      {researchOpen && idea.research_results && idea.research_results.length > 0 && (
        <ResearchBrief idea={idea} />
      )}

      {buildOpen && (
        <BuildPrototypeModal
          opportunity={ideaToOpportunity(idea)}
          sourceType="idea"
          open={buildOpen}
          onClose={() => setBuildOpen(false)}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function StudioPage() {
  const {
    loading: authLoading,
    user,
    isGuest,
    guestId,
    guestEmail,
    setGuestEmail,
  } = useRequireAuth("/studio");
  const { setPageContext } = useAgent();
  const [ideas, setIdeas] = useState<UserIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    title: string;
    description: string;
    category: string;
    video_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      supabase
        .from("user_ideas")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) toast.error("Couldn't load ideas");
          else setIdeas((data ?? []) as unknown as UserIdea[]);
          setLoading(false);
        });
      return;
    }

    if (isGuest && guestId && guestEmail) {
      fetch(`/api/guest/ideas?${new URLSearchParams({ guest_id: guestId, email: guestEmail })}`)
        .then((res) => res.json())
        .then((data: { ideas?: UserIdea[]; error?: string }) => {
          if (data.error) toast.error(data.error);
          setIdeas(data.ideas ?? []);
          setLoading(false);
        })
        .catch(() => {
          toast.error("Couldn't load guest ideas");
          setLoading(false);
        });
      return;
    }

    if (isGuest) {
      setIdeas([]);
      setLoading(false);
    }
  }, [authLoading, guestEmail, guestId, isGuest, user]);

  useEffect(() => {
    setPageContext({ type: "explore", query: "studio workspace", mode: "saved" });
  }, [setPageContext]);

  const handleCreated = (idea: UserIdea) => {
    setIdeas((prev) => [idea, ...prev]);
    setCreating(false);
    toast.success("Idea saved!");
  };

  const saveSignedInIdea = async (draft: {
    title: string;
    description: string;
    category: string;
    video_url: string | null;
  }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_ideas")
      .insert({
        user_id: user.id,
        owner_type: "auth",
        owner_email: user.email ?? null,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        video_url: draft.video_url,
      })
      .select()
      .single();

    if (error) toast.error(error.message);
    else handleCreated(data as unknown as UserIdea);
  };

  const saveGuestIdea = async (
    draft: {
      title: string;
      description: string;
      category: string;
      video_url: string | null;
    },
    email: string | null,
  ) => {
    if (!guestId) return;
    const res = await fetch("/api/guest/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, owner_email: email, guest_id: guestId }),
    });
    const data = (await res.json()) as { idea?: UserIdea; error?: string };
    if (!res.ok || data.error || !data.idea) {
      toast.error(data.error ?? "Couldn't save guest idea");
      return;
    }
    handleCreated(data.idea);
  };

  const handleSubmitIdea = async (draft: {
    title: string;
    description: string;
    category: string;
    video_url: string | null;
  }) => {
    if (user) {
      await saveSignedInIdea(draft);
      return;
    }

    if (!guestEmail) {
      setPendingDraft(draft);
      setEmailDialogOpen(true);
      return;
    }

    await saveGuestIdea(draft, guestEmail);
  };

  const handleUpdate = (updated: UserIdea) => {
    setIdeas((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleDelete = (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    toast.success("Idea deleted");
  };

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
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Your Idea Studio
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Capture business ideas, save video links, research the market, and launch your
            prototype. Guests can add an email to link projects, or continue without one.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            + Add idea
          </button>
        )}
      </div>

      {/* New idea form */}
      {creating && <NewIdeaForm onSubmit={handleSubmitIdea} onCancel={() => setCreating(false)} />}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Ideas grid */}
      {!loading && ideas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              userId={user?.id ?? null}
              ownerEmail={user?.email ?? guestEmail}
              guestId={guestId}
              isGuest={isGuest}
              onNeedEmail={() => setEmailDialogOpen(true)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <p className="mb-2 text-3xl">💡</p>
          <p className="text-lg font-semibold text-foreground">No ideas yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start by adding your first business idea above.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-6 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Add your first idea →
          </button>
        </div>
      )}
      <GuestEmailDialog
        open={emailDialogOpen}
        initialEmail={guestEmail}
        title="Save your ideas by email"
        description="No password needed. We'll use this email to keep your guest ideas and prototypes together."
        skipLabel="Skip and save"
        onOpenChange={setEmailDialogOpen}
        onSkip={() => {
          if (pendingDraft) {
            void saveGuestIdea(pendingDraft, null);
            setPendingDraft(null);
          }
        }}
        onSubmit={(email) => {
          setGuestEmail(email);
          if (pendingDraft) {
            void saveGuestIdea(pendingDraft, email);
            setPendingDraft(null);
          }
        }}
      />
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3 w-3 animate-spin text-current"
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
