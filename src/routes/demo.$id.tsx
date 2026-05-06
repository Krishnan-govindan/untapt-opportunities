import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const PALETTES = [
  ["#7c3aed", "#a855f7"],
  ["#6d28d9", "#8b5cf6"],
  ["#4f46e5", "#7c3aed"],
  ["#9333ea", "#c084fc"],
  ["#7e22ce", "#a855f7"],
  ["#5b21b6", "#8b5cf6"],
];

function palette(name: string) {
  return PALETTES[name.charCodeAt(0) % PALETTES.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function startupName(title: string) {
  return title.split(/\s+/).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function tagline(o: Opportunity) {
  return o.pain_summary.split(".")[0].trim();
}

function heroHeadline(o: Opportunity) {
  const name = startupName(o.title);
  return `${name} — built for ${o.icp.split(" ").slice(0, 6).join(" ")}`;
}

const TESTIMONIALS = [
  { quote: "Saved us 6 hours a week. Honestly can't imagine going back.", name: "Sarah K.", role: "Founder" },
  { quote: "Finally, a tool that actually gets our workflow.", name: "Marcus T.", role: "Operations Lead" },
  { quote: "ROI was positive in the first two weeks.", name: "Priya M.", role: "Head of Growth" },
];

// ── route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/demo/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error || !data) throw notFound();
    return data as Opportunity;
  },
  component: DemoPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Demo not found.
    </div>
  ),
});

// ── component ────────────────────────────────────────────────────────────────

function DemoPage() {
  const o = Route.useLoaderData() as Opportunity;
  const sName = startupName(o.title);
  const [from, to] = palette(sName);
  const inits = initials(sName);
  const slug = sName.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">

      {/* ── nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a]/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
          >
            {inits}
          </div>
          <span className="font-semibold tracking-tight">{sName}</span>
        </div>
        <div className="hidden gap-8 text-sm text-white/60 md:flex">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
        </div>
        <a
          href="#pricing"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Get early access
        </a>
      </nav>

      {/* ── hero ── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center">
        <div
          style={{ background: `linear-gradient(135deg, ${from}22, ${to}11)`, border: `1px solid ${from}44` }}
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
          >
          <span style={{ color: to }}>✦</span>
          <span className="text-white/70">Now in private beta · Built with AI</span>
        </div>
        <h1 className="mb-6 text-5xl font-bold tracking-tight leading-tight md:text-6xl">
          {heroHeadline(o)}
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/60 leading-relaxed">
          {tagline(o)}. Stop wasting hours on manual work — let {sName} handle it automatically.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#pricing"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            className="rounded-xl px-8 py-3.5 text-base font-semibold text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Start free trial →
          </a>
          <a href="#features" className="rounded-xl border border-white/20 px-8 py-3.5 text-base font-semibold text-white/80 hover:border-white/40 hover:text-white transition-all">
            See how it works
          </a>
        </div>
        <p className="mt-5 text-xs text-white/30">No credit card required · Cancel anytime</p>

        {/* fake app screenshot */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-3 font-mono text-xs text-white/30">{slug}.vercel.app</span>
          </div>
          <div className="bg-[#111] p-8">
            <div className="grid grid-cols-3 gap-4">
              {o.mvp_features.slice(0, 3).map((f, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                  <div
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                    className="mb-3 h-7 w-7 rounded-lg"
                  />
                  <p className="text-sm font-medium text-white/80">{f}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── features ── */}
      <section id="features" className="border-t border-white/10 bg-white/[0.02] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Features</p>
            <h2 className="text-4xl font-bold tracking-tight">Everything you need</h2>
            <p className="mt-4 text-white/50">Built specifically for {o.icp.split(",")[0]}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {o.mvp_features.map((f, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition-colors">
                <div
                  style={{ background: `linear-gradient(135deg, ${from}33, ${to}22)`, border: `1px solid ${from}44` }}
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                >
                  <span style={{ color: to }} className="text-lg">
                    {["⚡", "🔍", "🎯", "📊", "🚀", "✦"][i % 6]}
                  </span>
                </div>
                <h3 className="mb-2 font-semibold text-white">{f}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Designed to eliminate the manual overhead for {o.icp.split(" ").slice(0, 4).join(" ")}.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── testimonials ── */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Social proof</p>
            <h2 className="text-4xl font-bold tracking-tight">Loved by early users</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-4 text-sm text-white/70 leading-relaxed italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── competitors ── */}
      {o.competitors.length > 0 && (
        <section className="border-t border-white/10 bg-white/[0.02] py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-14 text-center">
              <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Comparison</p>
              <h2 className="text-4xl font-bold tracking-tight">Why {sName}?</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-4 text-left font-medium text-white/60">Tool</th>
                    <th className="px-6 py-4 text-left font-medium text-white/60">Pricing</th>
                    <th className="px-6 py-4 text-left font-medium text-white/60">Built for you?</th>
                  </tr>
                </thead>
                <tbody>
                  {o.competitors.map((c, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white/80">{c.name}</td>
                      <td className="px-6 py-4 font-mono text-white/50">{c.pricing}</td>
                      <td className="px-6 py-4 text-white/40">Enterprise only</td>
                    </tr>
                  ))}
                  <tr style={{ background: `linear-gradient(90deg, ${from}18, ${to}10)` }}>
                    <td className="px-6 py-4 font-semibold" style={{ color: to }}>{sName} ✦</td>
                    <td className="px-6 py-4 font-mono text-white">$49/mo</td>
                    <td className="px-6 py-4 font-medium text-green-400">Built exactly for you</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── pricing ── */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Pricing</p>
            <h2 className="text-4xl font-bold tracking-tight">Simple, honest pricing</h2>
            <p className="mt-4 text-white/50">TAM: {o.tam_estimate} · Urgency: {o.urgency_score}/10</p>
          </div>
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <p className="mb-1 text-sm font-medium text-white/50">Starter</p>
              <p className="mb-6 text-4xl font-bold">$49<span className="text-lg font-normal text-white/40">/mo</span></p>
              <ul className="space-y-3 text-sm text-white/70">
                {o.mvp_features.slice(0, 3).map((f, i) => (
                  <li key={i} className="flex gap-2"><span style={{ color: to }}>✓</span>{f}</li>
                ))}
              </ul>
              <button className="mt-8 w-full rounded-xl border border-white/20 py-3 text-sm font-semibold hover:border-white/40 transition-colors">
                Start free trial
              </button>
            </div>
            <div
              style={{ border: `1px solid ${from}66`, background: `linear-gradient(135deg, ${from}22, ${to}11)` }}
              className="relative rounded-2xl p-8"
            >
              <div style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-semibold">
                Most popular
              </div>
              <p className="mb-1 text-sm font-medium" style={{ color: to }}>Pro</p>
              <p className="mb-6 text-4xl font-bold">$149<span className="text-lg font-normal text-white/40">/mo</span></p>
              <ul className="space-y-3 text-sm text-white/70">
                {o.mvp_features.map((f, i) => (
                  <li key={i} className="flex gap-2"><span style={{ color: to }}>✓</span>{f}</li>
                ))}
              </ul>
              <button
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                className="mt-8 w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Get early access →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-white/10 py-10 text-center text-xs text-white/30">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
          >
            {inits}
          </div>
          <span className="font-medium text-white/50">{sName}</span>
        </div>
        <p>Built by <a href="https://untapt.lovable.app" className="underline hover:text-white/60 transition-colors">Untapt</a> · {slug}.vercel.app</p>
      </footer>
    </div>
  );
}
