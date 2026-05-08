import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { requireAuth, useRequireAuth } from "@/lib/require-auth";
import { useAgent } from "@/lib/agent-context";
import type { Opportunity, SourceDetail, UserIdea } from "@/lib/types";
import { SourceBadge } from "@/components/SourceBadge";
import { OpportunityCard } from "@/components/OpportunityCard";
import { BuildPrototypeModal } from "@/components/BuildPrototypeModal";

export const Route = createFileRoute("/business/$id")({
  beforeLoad: async () => {
    await requireAuth("/business/$id");
  },
  component: BusinessDetailPage,
});

type Prototype = {
  id: string;
  name: string;
  status: string;
  thumbnail_url: string | null;
  deployed_url: string | null;
  created_at: string;
  opportunity_id: string | null;
  source_type: string;
  source_idea_id: string | null;
  business_context?: unknown;
};

const BUSINESS_STARTERS = [
  "What's the best market for this?",
  "Who is the first ICP?",
  "What should the MVP include?",
  "Who are the competitors?",
];

function textFromMessage(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
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

function businessResearch(idea: UserIdea) {
  const signals = idea.research_results ?? [];
  const topSignal = signals[0];
  const sources = signals.flatMap((signal) => signal.sources_detail ?? []).slice(0, 6);
  const competitors = signals
    .flatMap((signal) => signal.competitors ?? [])
    .filter((competitor) => competitor.name)
    .slice(0, 6);
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
    painSummary: idea.description.slice(0, 220) || idea.title,
    painDescription:
      idea.description ||
      topSignal?.pain_description ||
      "The idea needs sharper validation around the buyer, pain intensity, and first workflow.",
    whyNow:
      topSignal?.why_now ??
      "The fastest path is to validate this as a narrow prototype, then use customer conversations to decide whether it deserves a larger build.",
    competitors,
    mvpFeatures,
    sources,
  };
}

function ideaToOpportunity(idea: UserIdea): Opportunity {
  const research = businessResearch(idea);
  return {
    id: idea.id,
    title: idea.title,
    pain_summary: research.painSummary,
    pain_description: research.painDescription,
    icp: research.icp,
    sources: [],
    sources_detail: research.sources,
    tam_estimate: research.tamEstimate,
    urgency_score: research.urgencyScore,
    competitors: research.competitors,
    why_now: research.whyNow,
    mvp_features: research.mvpFeatures,
    is_hot: research.urgencyScore >= 8,
    created_at: idea.created_at,
  };
}

function sourceLabel(source: SourceDetail): string {
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.platform;
  }
}

function ResearchSources({ sources }: { sources: SourceDetail[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {sources.map((source, index) => (
        <li key={`${source.url}-${index}`}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-border bg-secondary/40 p-3 hover:border-primary/40"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              {sourceLabel(source)}
            </span>
            <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
              {source.snippet || source.url}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function InsightStrip({ idea }: { idea: UserIdea }) {
  const research = businessResearch(idea);
  return (
    <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col items-center justify-center border-r border-border pr-4">
        <span className="text-3xl font-bold text-orange-400">{research.urgencyScore}</span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Urgency /10
        </span>
      </div>
      <div className="flex flex-col items-center justify-center border-r border-border px-4">
        <span className="text-2xl font-bold text-foreground">{research.tamEstimate}</span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Market size
        </span>
      </div>
      <div className="flex flex-col items-center justify-center pl-4">
        <span className="text-2xl font-bold text-primary">{research.signalCount}</span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Market signals
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

function BusinessChatPanel({
  idea,
  prototype,
}: {
  idea: UserIdea;
  prototype: Prototype | null;
}) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent" }), []);
  const { messages, sendMessage, status } = useChat({
    id: `business-${idea.id}-embedded`,
    transport,
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text?: string) => {
    const content = text ?? input.trim();
    if (!content || isLoading) return;
    setInput("");
    void sendMessage(
      { text: content },
      { body: { context: { type: "business", idea, prototype } } },
    );
  };

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Ask the analyst</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Market · ICP · Competitors · MVP
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-muted-foreground">Try asking:</p>
            {BUSINESS_STARTERS.map((question) => (
              <button
                key={question}
                onClick={() => send(question)}
                className="block w-full rounded-lg border border-border bg-secondary px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const text = textFromMessage(message);
          return (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-secondary text-foreground"
                }`}
              >
                {text || (
                  <span className="flex gap-1 py-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask anything about this business..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function BusinessDetailPage() {
  const { id } = Route.useParams();
  const { loading: authLoading, user, isGuest, guestId, guestEmail } = useRequireAuth(
    `/business/${id}`,
  );
  const { setPageContext } = useAgent();
  const [idea, setIdea] = useState<UserIdea | null>(null);
  const [prototype, setPrototype] = useState<Prototype | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const researchedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    const load = async () => {
      setLoading(true);
      try {
        if (user) {
          const [{ data: ideaData, error: ideaError }, { data: protoData, error: protoError }] =
            await Promise.all([
              supabase.from("user_ideas").select("*").eq("id", id).maybeSingle(),
              supabase
                .from("prototypes")
                .select(
                  "id, name, status, thumbnail_url, deployed_url, created_at, opportunity_id, source_type, source_idea_id, business_context",
                )
                .eq("source_idea_id", id)
                .order("created_at", { ascending: false })
                .limit(1),
            ]);
          if (ideaError) throw ideaError;
          if (protoError) throw protoError;
          setIdea((ideaData ?? null) as UserIdea | null);
          setPrototype(((protoData ?? [])[0] ?? null) as Prototype | null);
        } else if (isGuest && guestId) {
          const params = new URLSearchParams({ guest_id: guestId, id });
          if (guestEmail) params.set("email", guestEmail);
          const protoParams = new URLSearchParams({ guest_id: guestId, source_idea_id: id });
          if (guestEmail) protoParams.set("email", guestEmail);
          const [ideaRes, protoRes] = await Promise.all([
            fetch(`/api/guest/ideas?${params.toString()}`),
            fetch(`/api/guest/prototypes?${protoParams.toString()}`),
          ]);
          const ideaJson = (await ideaRes.json()) as { idea?: UserIdea; error?: string };
          const protoJson = (await protoRes.json()) as { prototypes?: Prototype[]; error?: string };
          if (!ideaRes.ok) throw new Error(ideaJson.error ?? "Idea not found");
          if (!protoRes.ok) throw new Error(protoJson.error ?? "Prototype not found");
          setIdea(ideaJson.idea ?? null);
          setPrototype((protoJson.prototypes ?? [])[0] ?? null);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't load business");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [authLoading, guestEmail, guestId, id, isGuest, user]);

  useEffect(() => {
    if (!idea) return;
    setPageContext({ type: "business", idea, prototype });
    return () => setPageContext(null);
  }, [idea, prototype, setPageContext]);

  useEffect(() => {
    if (!idea || researchedRef.current) return;
    if (idea.research_results && idea.research_results.length > 0) return;
    if (!user && (!isGuest || !guestId)) return;
    researchedRef.current = true;

    const runResearch = async () => {
      setResearching(true);
      const query = `${idea.title} ${idea.description}`.slice(0, 200).trim();
      try {
        const res = await fetch(`/api/explore/search?${new URLSearchParams({ q: query, limit: "6" })}`);
        const data = (await res.json()) as { opportunities?: Opportunity[]; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "Research failed");
        const results = data.opportunities ?? [];

        if (user) {
          await supabase
            .from("user_ideas")
            .update({ research_results: results as unknown as Json })
            .eq("id", idea.id);
        } else {
          await fetch("/api/guest/ideas", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: idea.id,
              owner_email: guestEmail,
              guest_id: guestId,
              research_results: results as unknown as Json,
            }),
          });
        }

        setIdea({ ...idea, research_results: results });
      } catch {
        toast.error("Research failed, but you can still chat about the idea");
      } finally {
        setResearching(false);
      }
    };

    void runResearch();
  }, [guestEmail, guestId, idea, isGuest, user]);

  if (authLoading || loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-24 text-center text-sm text-muted-foreground">
        Loading business...
      </main>
    );
  }

  if (!idea) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center text-sm text-muted-foreground">
        Business not found.
      </main>
    );
  }

  const research = businessResearch(idea);
  const businessOpportunity = ideaToOpportunity(idea);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <article className="space-y-8">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {idea.category}
              </span>
              {prototype?.status && (
                <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium capitalize text-green-400">
                  {prototype.status}
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                ID {idea.id.slice(0, 8)}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{idea.title}</h1>
            <p className="mt-3 text-base text-muted-foreground">{research.painSummary}</p>
            {researching && (
              <p className="mt-3 font-mono text-xs text-primary">Researching market signals...</p>
            )}

            <InsightStrip idea={idea} />

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <Link
                to="/my-businesses"
                className="rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary"
              >
                My Businesses
              </Link>
              {prototype?.deployed_url && (
                <a
                  href={prototype.deployed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15"
                >
                  Open app ↗
                </a>
              )}
              <button
                onClick={() => setBuildOpen(true)}
                className="rounded-md bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
              >
                Build prototype →
              </button>
            </div>
          </header>

          <div className="grid gap-8 rounded-xl border border-border bg-card p-6">
            <Section title="ICP">{research.icp}</Section>
            <Section title="Pain description">{research.painDescription}</Section>
            <Section title="Why now">{research.whyNow}</Section>

            {research.competitors.length > 0 && (
              <Section title="Competitors">
                <ul className="space-y-2">
                  {research.competitors.map((competitor) => (
                    <li
                      key={competitor.name}
                      className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2"
                    >
                      <span className="font-medium text-sm">{competitor.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {competitorPricing(competitor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Suggested MVP features">
              <ul className="space-y-1.5">
                {research.mvpFeatures.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-primary">▸</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {research.sources.length > 0 && (
              <Section title="Sources">
                <ResearchSources sources={research.sources} />
              </Section>
            )}
          </div>

          {(idea.research_results?.length ?? 0) > 0 && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Supporting market signals
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                These are public research signals behind your private business brief.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {idea.research_results?.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} o={opportunity} />
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <BusinessChatPanel idea={idea} prototype={prototype} />
        </aside>
      </div>

      <BuildPrototypeModal
        opportunity={businessOpportunity}
        sourceType="idea"
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
      />
    </main>
  );
}
