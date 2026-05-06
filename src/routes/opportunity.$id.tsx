import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";
import { SourceBadge } from "@/components/SourceBadge";
import { UrgencyMeter } from "@/components/UrgencyMeter";

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

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
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
        </div>
      </article>
    </main>
  );
}
