import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";
import { SourceBadge } from "@/components/SourceBadge";
import { UrgencyMeter } from "@/components/UrgencyMeter";
import { BuildPrototypeModal } from "@/components/BuildPrototypeModal";
import { ChatPanel } from "@/components/ChatPanel";

const PLATFORM_LABEL: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "HN",
  twitter: "X",
  google: "Product Hunt",
};

export const Route = createFileRoute("/opportunity/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error || !data) throw notFound();
    return data as Opportunity;
  },
  component: Detail,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center text-sm text-muted-foreground">
      Opportunity not found.
    </div>
  ),
});

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

function Detail() {
  const o = Route.useLoaderData() as Opportunity;
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <article className="space-y-8">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {o.sources.map((s) => (
                <SourceBadge key={s} source={s} />
              ))}
              {o.is_hot && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                  ● Hot
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                ID {o.id.slice(0, 8)}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{o.title}</h1>
            <p className="mt-3 text-base text-muted-foreground">{o.pain_summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  TAM
                </p>
                <p className="font-mono text-base text-foreground">{o.tam_estimate}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Urgency
                </p>
                <UrgencyMeter score={o.urgency_score} />
              </div>
              <button
                onClick={() => setOpen(true)}
                className="ml-auto rounded-md bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
              >
                Build this prototype →
              </button>
            </div>
          </header>

          <div className="grid gap-8 rounded-xl border border-border bg-card p-6">
            <Section title="ICP">{o.icp}</Section>
            <Section title="Pain description">{o.pain_description}</Section>
            <Section title="Why now">{o.why_now}</Section>
            <Section title="Competitors">
              <ul className="space-y-2">
                {o.competitors.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.pricing}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Suggested MVP features">
              <ul className="space-y-1.5">
                {o.mvp_features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">▸</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Section>
            {o.sources_detail && o.sources_detail.length > 0 && (
              <Section title="Sources">
                <ul className="space-y-4">
                  {o.sources_detail.map((s, i) => (
                    <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/40 p-3">
                      <div className="flex items-center gap-2">
                        <SourceBadge source={PLATFORM_LABEL[s.platform] ?? s.platform} href={s.url} />
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-muted-foreground hover:text-primary truncate"
                        >
                          ↗ {s.url}
                        </a>
                      </div>
                      {s.snippet && (
                        <p className="text-xs italic text-muted-foreground leading-relaxed border-l-2 border-border pl-2">
                          "{s.snippet}"
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ChatPanel opportunity={o} />
        </aside>
      </div>

      <BuildPrototypeModal opportunity={o} open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
