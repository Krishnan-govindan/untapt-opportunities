import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";
import { SourceBadge } from "@/components/SourceBadge";
import { BuildPrototypeModal } from "@/components/BuildPrototypeModal";
import { ChatPanel } from "@/components/ChatPanel";

const PLATFORM_LABEL: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "HN",
  twitter: "X",
  google: "Product Hunt",
};

// ─── Category badges ──────────────────────────────────────────────────────────
function categoryBadges(o: Opportunity) {
  const badges: { emoji: string; label: string; cls: string }[] = [];
  if (o.is_hot) badges.push({ emoji: "🔥", label: "Hot", cls: "badge-hot" });
  if (!o.is_hot && o.urgency_score >= 8)
    badges.push({ emoji: "⚡", label: "Urgent", cls: "badge-urgent" });
  if (o.urgency_score <= 3)
    badges.push({ emoji: "🧊", label: "Early", cls: "badge-early" });
  const tam = o.tam_estimate ?? "";
  if (/\$\d.*[BT]/.test(tam) || /billion|trillion/i.test(tam))
    badges.push({ emoji: "💰", label: "Big TAM", cls: "badge-tam" });
  if ((o.sources?.length ?? 0) >= 3)
    badges.push({ emoji: "📡", label: "Multi-signal", cls: "badge-multi" });
  return badges;
}

// ─── SVG urgency dial ─────────────────────────────────────────────────────────
function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad(startDeg));
  const sy = cy + r * Math.sin(rad(startDeg));
  const ex = cx + r * Math.cos(rad(endDeg));
  const ey = cy + r * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

function UrgencyDial({ score }: { score: number }) {
  const START = -120;
  const SWEEP = 240;
  const fillEnd = START + (score / 10) * SWEEP;
  const color =
    score >= 8 ? "#f97316" : score >= 5 ? "#a855f7" : "#60a5fa";
  const emoji = score >= 8 ? "🔥" : score >= 5 ? "⚡" : "🧊";
  const label = score >= 8 ? "High" : score >= 5 ? "Mid" : "Low";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 80" className="w-28 h-24">
        {/* track */}
        <path
          d={arc(50, 55, 34, START, START + SWEEP)}
          fill="none"
          stroke="oklch(0.22 0.01 270)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* fill */}
        {score > 0 && (
          <path
            d={arc(50, 55, 34, START, fillEnd)}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          />
        )}
        {/* center label */}
        <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
          {score}
        </text>
        <text x="50" y="65" textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace">
          /10
        </text>
      </svg>
      <span className="text-xs font-mono text-muted-foreground">
        {emoji} {label} urgency
      </span>
    </div>
  );
}

// ─── Competitor price chart ───────────────────────────────────────────────────
function parsePrice(pricing: string): number {
  const m = pricing.match(/\$(\d[\d,]*)/);
  if (!m) return 0;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

function CompetitorChart({ competitors }: { competitors: { name: string; pricing: string }[] }) {
  if (!competitors?.length) return null;

  const data = competitors.map((c) => ({
    name: c.name.length > 16 ? c.name.slice(0, 15) + "…" : c.name,
    price: parsePrice(c.pricing),
    pricing: c.pricing,
  }));
  const max = Math.max(...data.map((d) => d.price), 1);

  const COLORS = ["#a855f7", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"];

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Competitors — pricing comparison
      </p>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 44, 80)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            domain={[0, max * 1.15]}
            tickFormatter={(v) => (v === 0 ? "" : `$${v}`)}
            tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: "#d1d5db", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "oklch(0.22 0.01 270 / 60%)" }}
            contentStyle={{
              background: "#1a1a2e",
              border: "1px solid #2a2a3e",
              borderRadius: 8,
              fontSize: 12,
              color: "#d1d5db",
            }}
            formatter={(_v: number, _k: string, item: { payload: { pricing: string } }) => [
              item.payload.pricing,
              "Price",
            ]}
          />
          <Bar dataKey="price" radius={[0, 4, 4, 0]} minPointSize={6}>
            {data.map((_entry, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Fallback table for zero-price competitors */}
      {data.some((d) => d.price === 0) && (
        <ul className="mt-2 space-y-1">
          {data
            .filter((d) => d.price === 0)
            .map((d, i) => (
              <li key={i} className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-1.5 text-xs">
                <span className="font-medium text-foreground">{d.name}</span>
                <span className="font-mono text-muted-foreground">{d.pricing}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

// ─── Opportunity score radial ─────────────────────────────────────────────────
function ScoreBars({ o }: { o: Opportunity }) {
  const tam = o.tam_estimate ?? "";
  const tamScore =
    /[BT]/.test(tam) ? 9 : /\$\d.*M/.test(tam) ? 6 : 4;

  const bars = [
    { label: "Urgency", value: o.urgency_score * 10, fill: "#a855f7" },
    { label: "Market", value: tamScore * 10, fill: "#22d3ee" },
    { label: "Signals", value: Math.min((o.sources?.length ?? 1) * 25, 100), fill: "#f97316" },
  ];

  return (
    <ResponsiveContainer width="100%" height={120}>
      <RadialBarChart
        cx="50%"
        cy="80%"
        innerRadius="40%"
        outerRadius="100%"
        startAngle={180}
        endAngle={0}
        data={bars}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" background={{ fill: "#1e1e2e" }} cornerRadius={4} label={false} />
        <Tooltip
          contentStyle={{
            background: "#1a1a2e",
            border: "1px solid #2a2a3e",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v}%`]}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
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

// ─── Route ───────────────────────────────────────────────────────────────────
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

function Detail() {
  const o = Route.useLoaderData() as Opportunity;
  const [open, setOpen] = useState(false);
  const validSources = (o.sources ?? []).filter((s) => !s.startsWith("http"));
  const badges = categoryBadges({ ...o, sources: validSources });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <article className="space-y-8">

          {/* ── Header ── */}
          <header>
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {validSources.map((s) => (
                <SourceBadge key={s} source={s} />
              ))}
              {badges.map((b) => (
                <span key={b.label} className={`category-badge ${b.cls}`}>
                  {b.emoji} {b.label}
                </span>
              ))}
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                ID {o.id.slice(0, 8)}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{o.title}</h1>
            <p className="mt-3 text-base text-muted-foreground">{o.pain_summary}</p>

            {/* ── Insight strip ── */}
            <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-border bg-card p-5">
              {/* Urgency dial */}
              <div className="flex flex-col items-center justify-center border-r border-border pr-4">
                <UrgencyDial score={o.urgency_score} />
              </div>

              {/* TAM */}
              <div className="flex flex-col items-center justify-center gap-1 border-r border-border px-4">
                <span className="text-2xl font-bold text-foreground">{o.tam_estimate}</span>
                <span className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  💰 Market size
                </span>
                <div className="mt-2 w-full">
                  <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                    <span>Niche</span><span>Massive</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                      style={{
                        width: /[BT]/.test(o.tam_estimate) ? "90%" : /M/.test(o.tam_estimate) ? "60%" : "35%",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Signal strength */}
              <div className="flex flex-col items-center justify-center gap-2 pl-4">
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {validSources.map((src) => (
                    <span
                      key={src}
                      className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-foreground"
                    >
                      {src}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  📡 {validSources.length} platform{validSources.length !== 1 ? "s" : ""}
                </span>
                {/* mini radial bars */}
                <ScoreBars o={{ ...o, sources: validSources }} />
                <div className="flex gap-3 text-[9px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-violet-500" />Urgency</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />Market</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />Signal</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setOpen(true)}
                className="rounded-md bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
              >
                Build this business →
              </button>
            </div>
          </header>

          {/* ── Main content ── */}
          <div className="grid gap-8 rounded-xl border border-border bg-card p-6">
            <Section title="ICP">{o.icp}</Section>
            <Section title="Pain description">{o.pain_description}</Section>
            <Section title="Why now">{o.why_now}</Section>

            {/* Competitor chart */}
            <section>
              <CompetitorChart competitors={o.competitors} />
              {/* Also show non-chart rows for pricing strings that had $0 parsed but aren't truly free */}
              <ul className="mt-3 space-y-2">
                {o.competitors
                  .filter((c) => parsePrice(c.pricing) > 0)
                  .map((c, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2"
                    >
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.pricing}</span>
                    </li>
                  ))}
              </ul>
            </section>

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
                    <li
                      key={i}
                      className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <SourceBadge
                          source={PLATFORM_LABEL[s.platform] ?? s.platform}
                          href={s.url}
                        />
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-mono text-[10px] text-muted-foreground hover:text-primary"
                        >
                          ↗ {s.url}
                        </a>
                      </div>
                      {s.snippet && (
                        <p className="border-l-2 border-border pl-2 text-xs italic leading-relaxed text-muted-foreground">
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
