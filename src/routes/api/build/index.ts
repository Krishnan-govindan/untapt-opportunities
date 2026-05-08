import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serverEnv } from "@/lib/env.server";
import { guestIdentityFromValues } from "@/lib/guest.server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nanoid(len = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 28)
    .replace(/-+$/, "");
}

function toStartupName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanUrl(url: string): string {
  return url.startsWith("https://") ? url : `https://${url}`;
}

// ─── Business Strategy ────────────────────────────────────────────────────────

interface BusinessContext {
  mission: string;
  vision: string;
  tagline: string;
  value_prop: string;
  gtm_strategy: string[];
  icp_refined: string;
}

function buildBusinessStrategy(opp: Record<string, unknown>, startupName: string): BusinessContext {
  const mvp = (opp.mvp_features as string[] | undefined) ?? [];
  const icp = String(opp.icp ?? "operators");
  const pain = String(opp.pain_summary ?? "their core pain point");
  const whyNow = String(opp.why_now ?? "");
  return {
    mission: `We help ${icp} eliminate ${pain}`,
    vision: `A world where ${String(opp.title ?? "this problem")} is no longer a blocker for the teams who feel it most.`,
    tagline: startupName,
    value_prop: String(opp.pain_description ?? opp.pain_summary ?? ""),
    gtm_strategy: [
      `Start with ${icp.split(",")[0] || "the highest-intent customer segment"}.`,
      whyNow
        ? `Anchor outreach around the timing trigger: ${whyNow}`
        : "Use the visible pain as the lead magnet for early conversations.",
      ...mvp.slice(0, 2).map((f) => `Ship a narrow workflow around ${f}.`),
    ].slice(0, 4),
    icp_refined: icp,
  };
}

// ─── Logo Generation ──────────────────────────────────────────────────────────

const LOGO_PALETTES = [
  ["#7c3aed", "#a855f7"],
  ["#6d28d9", "#8b5cf6"],
  ["#4f46e5", "#7c3aed"],
  ["#9333ea", "#c084fc"],
  ["#7e22ce", "#a855f7"],
  ["#5b21b6", "#8b5cf6"],
];

function generateLogoSvg(startupName: string): string {
  const words = startupName.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
      : startupName.slice(0, 2).toUpperCase();

  const paletteIdx = (startupName.charCodeAt(0) ?? 0) % LOGO_PALETTES.length;
  const [colorStart, colorEnd] = LOGO_PALETTES[paletteIdx];

  return `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colorStart}"/>
      <stop offset="100%" style="stop-color:${colorEnd}"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="24" fill="url(#g)"/>
  <text x="60" y="60" dominant-baseline="central" text-anchor="middle"
        font-family="system-ui,ui-sans-serif,sans-serif" font-weight="700"
        font-size="${initials.length === 1 ? 56 : 46}" fill="white" letter-spacing="-1">${initials}</text>
</svg>`;
}

function svgToBase64DataUrl(svg: string): string {
  const b64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}

// ─── Cached Prototype Template ───────────────────────────────────────────────

function templateData(opp: Record<string, unknown>, startupName: string): Record<string, unknown> {
  const paletteIdx = (startupName.charCodeAt(0) ?? 0) % LOGO_PALETTES.length;
  const mvpFeatures = (opp.mvp_features as string[] | undefined) ?? [];
  const competitors = (
    (opp.competitors as
      | Array<{ name?: string; pricing?: string; pricing_hint?: string }>
      | undefined) ?? []
  )
    .filter((competitor) => competitor.name)
    .map((competitor) => ({
      name: String(competitor.name),
      pricing: String(competitor.pricing ?? competitor.pricing_hint ?? "Unknown"),
    }));

  return {
    startupName,
    initials: startupName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join(""),
    slug: startupName.toLowerCase().replace(/\s+/g, "-"),
    title: String(opp.title ?? startupName),
    painSummary: String(opp.pain_summary ?? ""),
    painDescription: String(opp.pain_description ?? opp.pain_summary ?? ""),
    icp: String(opp.icp ?? "early teams"),
    whyNow: String(opp.why_now ?? ""),
    tamEstimate: String(opp.tam_estimate ?? "?"),
    urgencyScore: String(opp.urgency_score ?? "?"),
    mvpFeatures:
      mvpFeatures.length > 0
        ? mvpFeatures
        : [
            "Capture the core workflow in one shared workspace",
            "Automate the most repetitive handoff",
            "Show a simple customer-facing status view",
          ],
    competitors,
    palette: LOGO_PALETTES[paletteIdx],
  };
}

function buildCachedPageTSX(opp: Record<string, unknown>, startupName: string): string {
  return `type PrototypeData = {
  startupName: string;
  initials: string;
  slug: string;
  title: string;
  painSummary: string;
  painDescription: string;
  icp: string;
  whyNow: string;
  tamEstimate: string;
  urgencyScore: string;
  mvpFeatures: string[];
  competitors: Array<{ name: string; pricing: string }>;
  palette: string[];
};

const data: PrototypeData = ${JSON.stringify(templateData(opp, startupName), null, 2)};

const TESTIMONIALS = [
  { quote: "Saved us 6 hours a week. Honestly can't imagine going back.", name: "Sarah K.", role: "Founder" },
  { quote: "Finally, a tool that actually gets our workflow.", name: "Marcus T.", role: "Operations Lead" },
  { quote: "ROI was positive in the first two weeks.", name: "Priya M.", role: "Head of Growth" },
];

const featureIcons = ["⚡", "🔍", "🎯", "📊", "🚀", "✦"];

export default function Page() {
  const from = data.palette[0];
  const to = data.palette[1];
  const icpShort = data.icp.split(" ").slice(0, 6).join(" ");
  const tagline = data.painSummary.split(".")[0].trim() || data.painSummary;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a]/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
          >
            {data.initials}
          </div>
          <span className="font-semibold tracking-tight">{data.startupName}</span>
        </div>
        <div className="hidden gap-8 text-sm text-white/60 md:flex">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
        </div>
        <a
          href="#pricing"
          style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Get early access
        </a>
      </nav>

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center">
        <div
          style={{ background: "linear-gradient(135deg, " + from + "22, " + to + "11)", border: "1px solid " + from + "44" }}
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
        >
          <span style={{ color: to }}>✦</span>
          <span className="text-white/70">Now in private beta · Built with Untapt</span>
        </div>
        <h1 className="mb-6 text-5xl font-bold tracking-tight leading-tight md:text-6xl">
          {data.startupName} — built for {icpShort}
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/60 leading-relaxed">
          {tagline}. Stop wasting hours on manual work — let {data.startupName} handle it automatically.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#pricing"
            style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
            className="rounded-xl px-8 py-3.5 text-base font-semibold text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Start free trial →
          </a>
          <a href="#features" className="rounded-xl border border-white/20 px-8 py-3.5 text-base font-semibold text-white/80 hover:border-white/40 hover:text-white transition-all">
            See how it works
          </a>
        </div>
        <p className="mt-5 text-xs text-white/30">No credit card required · Cancel anytime</p>

        <div className="mt-16 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-3 font-mono text-xs text-white/30">{data.slug}.vercel.app</span>
          </div>
          <div className="bg-[#111] p-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {data.mvpFeatures.slice(0, 3).map((feature, index) => (
                <div key={feature} className="rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                  <div
                    style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
                    className="mb-3 h-7 w-7 rounded-lg"
                  />
                  <p className="text-sm font-medium text-white/80">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-white/10 bg-white/[0.02] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Features</p>
            <h2 className="text-4xl font-bold tracking-tight">Everything you need</h2>
            <p className="mt-4 text-white/50">Built specifically for {data.icp.split(",")[0]}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.mvpFeatures.map((feature, index) => (
              <div key={feature} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition-colors">
                <div
                  style={{ background: "linear-gradient(135deg, " + from + "33, " + to + "22)", border: "1px solid " + from + "44" }}
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                >
                  <span style={{ color: to }} className="text-lg">{featureIcons[index % featureIcons.length]}</span>
                </div>
                <h3 className="mb-2 font-semibold text-white">{feature}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Designed to eliminate the manual overhead for {data.icp.split(" ").slice(0, 4).join(" ")}.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Social proof</p>
            <h2 className="text-4xl font-bold tracking-tight">Loved by early users</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <div key={testimonial.name} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-4 text-sm text-white/70 leading-relaxed italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  >
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{testimonial.name}</p>
                    <p className="text-xs text-white/40">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {data.competitors.length > 0 && (
        <section className="border-t border-white/10 bg-white/[0.02] py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-14 text-center">
              <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Comparison</p>
              <h2 className="text-4xl font-bold tracking-tight">Why {data.startupName}?</h2>
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
                  {data.competitors.map((competitor) => (
                    <tr key={competitor.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white/80">{competitor.name}</td>
                      <td className="px-6 py-4 font-mono text-white/50">{competitor.pricing}</td>
                      <td className="px-6 py-4 text-white/40">Enterprise only</td>
                    </tr>
                  ))}
                  <tr style={{ background: "linear-gradient(90deg, " + from + "18, " + to + "10)" }}>
                    <td className="px-6 py-4 font-semibold" style={{ color: to }}>{data.startupName} ✦</td>
                    <td className="px-6 py-4 font-mono text-white">$49/mo</td>
                    <td className="px-6 py-4 font-medium text-green-400">Built exactly for you</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p style={{ color: to }} className="mb-3 text-sm font-medium uppercase tracking-widest">Pricing</p>
            <h2 className="text-4xl font-bold tracking-tight">Simple, honest pricing</h2>
            <p className="mt-4 text-white/50">TAM: {data.tamEstimate} · Urgency: {data.urgencyScore}/10</p>
          </div>
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <p className="mb-1 text-sm font-medium text-white/50">Starter</p>
              <p className="mb-6 text-4xl font-bold">$49<span className="text-lg font-normal text-white/40">/mo</span></p>
              <ul className="space-y-3 text-sm text-white/70">
                {data.mvpFeatures.slice(0, 3).map((feature) => (
                  <li key={feature} className="flex gap-2"><span style={{ color: to }}>✓</span>{feature}</li>
                ))}
              </ul>
              <button className="mt-8 w-full rounded-xl border border-white/20 py-3 text-sm font-semibold hover:border-white/40 transition-colors">
                Start free trial
              </button>
            </div>
            <div
              style={{ border: "1px solid " + from + "66", background: "linear-gradient(135deg, " + from + "22, " + to + "11)" }}
              className="relative rounded-2xl p-8"
            >
              <div style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }} className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-semibold">
                Most popular
              </div>
              <p className="mb-1 text-sm font-medium" style={{ color: to }}>Pro</p>
              <p className="mb-6 text-4xl font-bold">$149<span className="text-lg font-normal text-white/40">/mo</span></p>
              <ul className="space-y-3 text-sm text-white/70">
                {data.mvpFeatures.map((feature) => (
                  <li key={feature} className="flex gap-2"><span style={{ color: to }}>✓</span>{feature}</li>
                ))}
              </ul>
              <button
                style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
                className="mt-8 w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Get early access →
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-xs text-white/30">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            style={{ background: "linear-gradient(135deg, " + from + ", " + to + ")" }}
            className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
          >
            {data.initials}
          </div>
          <span className="font-medium text-white/50">{data.startupName}</span>
        </div>
        <p>Built by <a href="https://untapt-opportunities.vercel.app" className="underline hover:text-white/60 transition-colors">Untapt</a> · {data.slug}.vercel.app</p>
      </footer>
    </div>
  );
}
`;
}

// ─── Vercel Deployment ────────────────────────────────────────────────────────

function buildVercelFiles(
  pageTSX: string,
  projectName: string,
  startupName: string,
  description: string,
) {
  const pkg = JSON.stringify(
    {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: {
        next: "16.2.6",
        react: "^19.2.0",
        "react-dom": "^19.2.0",
      },
      devDependencies: {
        "@types/node": "^22",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        typescript: "^5",
        tailwindcss: "^3.4.1",
        autoprefixer: "^10.4.20",
        postcss: "^8",
      },
    },
    null,
    2,
  );

  const safeTitle = startupName.replace(/'/g, "\\'");
  const safeDesc = description.replace(/'/g, "\\'").slice(0, 160);

  const layout = `import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: '${safeTitle}',
  description: '${safeDesc}',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}`;

  const tsconfig = JSON.stringify(
    {
      compilerOptions: {
        target: "es5",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
    null,
    2,
  );

  return [
    { file: "package.json", data: pkg },
    { file: "next.config.js", data: "module.exports = {}" },
    {
      file: "tailwind.config.js",
      data: `module.exports = { content: ['./app/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }`,
    },
    {
      file: "postcss.config.js",
      data: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }`,
    },
    { file: "tsconfig.json", data: tsconfig },
    {
      file: "app/globals.css",
      data: "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
    },
    { file: "app/layout.tsx", data: layout },
    { file: "app/page.tsx", data: pageTSX },
  ];
}

async function deployToVercel(
  files: Array<{ file: string; data: string }>,
  projectName: string,
): Promise<{ id: string; url: string }> {
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv("VERCEL_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectName,
      files: files.map((f) => ({ ...f, encoding: "utf-8" })),
      projectSettings: { framework: "nextjs", nodeVersion: "22.x" },
      target: "production",
    }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg =
      (body.error as Record<string, string> | undefined)?.message ?? JSON.stringify(body);
    throw new Error(`Vercel deploy failed: ${errMsg}`);
  }

  return { id: body.id as string, url: cleanUrl(body.url as string) };
}

async function pollUntilReady(deploymentId: string): Promise<string> {
  for (let i = 0; i < 36; i++) {
    await sleep(5_000);
    const res = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${serverEnv("VERCEL_TOKEN")}` },
    });
    const data = (await res.json()) as Record<string, unknown>;
    const state = (data.readyState ?? data.state) as string | undefined;
    if (state === "READY") return cleanUrl(data.url as string);
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Deployment ${state}: ${(data.errorMessage as string) ?? ""}`);
    }
  }
  throw new Error("Deployment timed out after 3 minutes");
}

// ─── Email ────────────────────────────────────────────────────────────────────

function logoHtml(initials: string, colorStart: string, colorEnd: string): string {
  return `<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,${colorStart},${colorEnd});display:inline-block;line-height:56px;text-align:center;color:white;font-weight:700;font-size:${initials.length === 1 ? 28 : 22}px;font-family:system-ui,sans-serif;letter-spacing:-1px;vertical-align:middle;">${initials}</div>`;
}

async function sendEmail(
  to: string,
  url: string,
  startupName: string,
  opp: Record<string, unknown>,
  context: BusinessContext,
): Promise<void> {
  const resendApiKey = serverEnv("RESEND_API_KEY");
  if (!resendApiKey) return;

  const words = startupName.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
      : startupName.slice(0, 2).toUpperCase();

  const paletteIdx = (startupName.charCodeAt(0) ?? 0) % LOGO_PALETTES.length;
  const [colorStart, colorEnd] = LOGO_PALETTES[paletteIdx];

  const competitors = (opp.competitors as { name: string; pricing: string }[] | undefined) ?? [];
  const mvpFeatures = (opp.mvp_features as string[] | undefined) ?? [];
  const gtm = context.gtm_strategy ?? [];

  const competitorRows = competitors
    .map(
      (c) =>
        `<tr>
          <td style="padding:6px 8px;color:#e2e8f0;font-size:13px;">${c.name}</td>
          <td style="padding:6px 8px;color:#6b7280;font-size:12px;font-family:monospace;text-align:right;">${c.pricing}</td>
        </tr>`,
    )
    .join("");

  const featureItems = mvpFeatures
    .map((f) => `<p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">▸ ${f}</p>`)
    .join("");

  const gtmItems = gtm
    .map((s, i) => `<p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">${i + 1}. ${s}</p>`)
    .join("");

  const divider = `<hr style="border:none;border-top:1px solid #1f2937;margin:20px 0;">`;
  const label = (text: string) =>
    `<p style="margin:0 0 6px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">${text}</p>`;

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e2e8f0;padding:32px;border-radius:12px;">

      <!-- Header: logo + name -->
      <div style="margin-bottom:24px;">
        ${logoHtml(initials, colorStart, colorEnd)}
        <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:20px;font-weight:700;color:#f1f5f9;">${startupName}</span>
      </div>

      <!-- Heading -->
      <h1 style="color:#a855f7;font-size:22px;margin:0 0 4px;">Your startup is live.</h1>
      <p style="color:#94a3b8;margin:0 0 8px;font-size:13px;font-style:italic;">${context.tagline}</p>

      <!-- CTA button -->
      <a href="${url}" style="display:inline-block;background:linear-gradient(to right,#7c3aed,#a855f7);color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0 24px;">View your prototype →</a>

      ${divider}

      <!-- Mission & Vision -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        <tr>
          <td width="50%" style="padding-right:16px;vertical-align:top;">
            ${label("Mission")}
            <p style="margin:0;color:#e2e8f0;font-size:13px;line-height:1.5;">${context.mission}</p>
          </td>
          <td width="50%" style="vertical-align:top;">
            ${label("Vision")}
            <p style="margin:0;color:#e2e8f0;font-size:13px;line-height:1.5;">${context.vision}</p>
          </td>
        </tr>
      </table>

      ${divider}

      <!-- ICP -->
      ${label("Your Customer")}
      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">${context.icp_refined}</p>

      ${divider}

      <!-- GTM -->
      ${label("Go-To-Market Strategy")}
      ${gtmItems}

      ${
        competitors.length > 0
          ? `
      ${divider}

      <!-- Competitors -->
      ${label("Competitive Landscape")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background:#111827;">
          <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-align:left;font-weight:500;">Competitor</th>
          <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-align:right;font-weight:500;">Pricing</th>
        </tr>
        ${competitorRows}
      </table>`
          : ""
      }

      ${
        mvpFeatures.length > 0
          ? `
      ${divider}

      <!-- MVP Features -->
      ${label("MVP Features")}
      ${featureItems}`
          : ""
      }

      ${divider}

      <!-- Market stats -->
      <p style="margin:0;color:#6b7280;font-size:12px;">
        TAM: <span style="color:#94a3b8;">${String(opp.tam_estimate ?? "?")}</span>
        &nbsp;·&nbsp;
        Urgency: <span style="color:#94a3b8;">${opp.urgency_score}/10</span>
      </p>

      ${divider}

      <p style="margin:0;color:#4b5563;font-size:11px;">Untapt — surfaces unmonetized startup opportunities</p>
    </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Untapt <onboarding@resend.dev>",
      to: [to],
      subject: `Your startup is live: ${startupName}`,
      html,
    }),
  }).catch(() => {}); // email failure never kills the build
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

type BuildSourceType = "opportunity" | "idea";

type BuildSource = {
  sourceType: BuildSourceType;
  opportunityId: string | null;
  sourceIdeaId: string | null;
  data: Record<string, unknown>;
};

type UserIdeaRow = {
  id: string;
  user_id: string | null;
  owner_email: string | null;
  guest_id: string | null;
  owner_type: string;
  title: string;
  description: string;
  category: string;
  files: unknown;
  video_url: string | null;
  research_results: unknown;
  created_at: string;
};

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function ideaToTemplateOpportunity(idea: UserIdeaRow): Record<string, unknown> {
  const researchResults = arrayValue(idea.research_results);
  const firstResearch = researchResults[0] ?? {};
  const files = arrayValue(idea.files);
  const researchedFeatures = researchResults.flatMap((result) =>
    stringArrayValue(result.mvp_features).slice(0, 2),
  );
  const fallbackFeatures = [
    "Capture every new idea in one private workspace",
    "Turn raw notes into a clear validation checklist",
    "Launch a focused prototype that explains the offer",
    "Track market signals and customer feedback in one place",
  ];

  const competitors = researchResults
    .flatMap((result) => arrayValue(result.competitors))
    .filter((competitor) => competitor.name)
    .slice(0, 5)
    .map((competitor) => ({
      name: String(competitor.name),
      pricing: String(competitor.pricing ?? competitor.pricing_hint ?? "Unknown"),
    }));

  const sourceNotes = [
    idea.video_url ? `Video: ${idea.video_url}` : "",
    files.length > 0
      ? `Attached files: ${files.map((file) => String(file.name ?? "file")).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: idea.id,
    title: idea.title,
    pain_summary: idea.description || idea.title,
    pain_description: [idea.description, sourceNotes].filter(Boolean).join("\n\n") || idea.title,
    icp: String(firstResearch.icp ?? `Founders and operators validating ${idea.category} ideas`),
    sources: [
      idea.video_url,
      ...researchResults.flatMap((result) => stringArrayValue(result.sources)),
    ]
      .filter((source): source is string => Boolean(source))
      .slice(0, 8),
    tam_estimate: String(firstResearch.tam_estimate ?? "TBD"),
    urgency_score:
      typeof firstResearch.urgency_score === "number" ? firstResearch.urgency_score : 6,
    competitors,
    why_now:
      String(firstResearch.why_now ?? "").trim() ||
      `This ${idea.category.toLowerCase()} idea is ready for fast market validation and a focused prototype.`,
    mvp_features:
      researchedFeatures.length > 0
        ? [...new Set(researchedFeatures)].slice(0, 6)
        : fallbackFeatures,
    is_hot: false,
    created_at: idea.created_at,
    category: idea.category,
    source_type: "idea",
  };
}

async function resolveBuildSource({
  sourceType,
  opportunityId,
  sourceIdeaId,
  userId,
  ownerType,
  email,
  guestId,
}: {
  sourceType: BuildSourceType;
  opportunityId?: string;
  sourceIdeaId?: string;
  userId: string | null;
  ownerType: "auth" | "guest";
  email: string;
  guestId: string | null;
}): Promise<BuildSource> {
  if (sourceType === "opportunity") {
    if (!opportunityId) throw new Error("opportunity_id is required");

    const { data: opp, error } = await supabaseAdmin
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .maybeSingle();

    if (error || !opp) throw new Error("Opportunity not found");

    return {
      sourceType,
      opportunityId,
      sourceIdeaId: null,
      data: opp as Record<string, unknown>,
    };
  }

  if (!sourceIdeaId) throw new Error("source_idea_id is required");

  let query = supabaseAdmin.from("user_ideas").select("*").eq("id", sourceIdeaId);
  if (ownerType === "auth") {
    if (!userId) throw new Error("Sign in again to build this idea");
    query = query.eq("user_id", userId);
  } else {
    if (!guestId) throw new Error("Valid guest id is required");
    query = query.eq("owner_type", "guest").eq("guest_id", guestId);
    if (email) query = query.eq("owner_email", email);
    else query = query.is("owner_email", null);
  }

  const { data: idea, error } = await query.maybeSingle();
  if (error || !idea) throw new Error("Idea not found or not accessible");

  return {
    sourceType,
    opportunityId: null,
    sourceIdeaId,
    data: ideaToTemplateOpportunity(idea as UserIdeaRow),
  };
}

async function runPipeline(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  sourceType: BuildSourceType,
  opportunityId: string | undefined,
  sourceIdeaId: string | undefined,
  email: string,
  userId: string | null,
  ownerType: "auth" | "guest",
  guestId?: string | null,
): Promise<void> {
  const enc = new TextEncoder();
  const send = (event: string, data: object) => {
    try {
      writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      // client disconnected — ignore
    }
  };

  let prototypeId: string | undefined;

  try {
    // ── 1. Resolve source data ───────────────────────────────────────────────
    send("status", { step: "researching", message: "Fetching source data…" });

    const source = await resolveBuildSource({
      sourceType,
      opportunityId,
      sourceIdeaId,
      userId,
      ownerType,
      email,
      guestId: guestId ?? null,
    });

    const opp = source.data;
    const slug = toSlug(String(opp.title ?? "prototype"));
    const startupName = toStartupName(slug);

    // ── 2. Create prototype row ──────────────────────────────────────────────
    send("status", { step: "researching", message: "Setting up build job…" });

    const { data: proto, error: protoErr } = await supabaseAdmin
      .from("prototypes")
      .insert({
        user_id: userId,
        owner_type: ownerType,
        owner_email: email || null,
        guest_id: guestId ?? null,
        opportunity_id: source.opportunityId,
        source_type: source.sourceType,
        source_idea_id: source.sourceIdeaId,
        name: startupName,
        email,
        status: "researching",
      })
      .select("id")
      .single();

    if (protoErr || !proto) throw new Error("Failed to create prototype record");
    prototypeId = proto.id;
    send("job_id", { job_id: prototypeId });

    // ── 2.5. Assemble business strategy from cached opportunity data ────────
    send("status", { step: "strategizing", message: "Assembling business plan…" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any)
      .from("prototypes")
      .update({ status: "strategizing" })
      .eq("id", prototypeId)
      .then(
        () => {},
        () => {},
      );

    const context = buildBusinessStrategy(opp, startupName);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any)
      .from("prototypes")
      .update({ business_context: context })
      .eq("id", prototypeId)
      .then(
        () => {},
        () => {},
      );

    // ── 2.6. Generate logo ───────────────────────────────────────────────────
    send("status", { step: "branding", message: "Generating your brand identity…" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any)
      .from("prototypes")
      .update({ status: "branding" })
      .eq("id", prototypeId)
      .then(
        () => {},
        () => {},
      );

    const logoSvg = generateLogoSvg(startupName);
    const logoDataUrl = svgToBase64DataUrl(logoSvg);

    await supabaseAdmin
      .from("prototypes")
      .update({ thumbnail_url: logoDataUrl })
      .eq("id", prototypeId);

    // ── 3. Fill the cached prototype template ────────────────────────────────
    send("status", { step: "designing", message: "Assembling cached landing page…" });
    await supabaseAdmin.from("prototypes").update({ status: "designing" }).eq("id", prototypeId);

    const pageTSX = buildCachedPageTSX(opp, startupName);

    // ── 4. Deploy to Vercel ──────────────────────────────────────────────────
    send("status", { step: "deploying", message: "Uploading files to Vercel…" });
    await supabaseAdmin.from("prototypes").update({ status: "deploying" }).eq("id", prototypeId);

    const projectName = `pain-${slug}-${nanoid()}`;
    const files = buildVercelFiles(
      pageTSX,
      projectName,
      startupName,
      String(opp.pain_summary ?? ""),
    );

    let deploymentId: string;
    try {
      const result = await deployToVercel(files, projectName);
      deploymentId = result.id;
    } catch {
      send("status", { step: "deploying", message: "Retrying deployment…" });
      await sleep(3_000);
      const result = await deployToVercel(files, projectName);
      deploymentId = result.id;
    }

    // ── 5. Poll until ready ──────────────────────────────────────────────────
    send("status", { step: "deploying", message: "Waiting for deployment to go live…" });
    const liveUrl = await pollUntilReady(deploymentId);

    // ── 6. Email + finalize ──────────────────────────────────────────────────
    send("status", { step: "deploying", message: "Sending your business plan…" });

    await Promise.all([
      email ? sendEmail(email, liveUrl, startupName, opp, context) : Promise.resolve(),
      supabaseAdmin
        .from("prototypes")
        .update({ status: "deployed", deployed_url: liveUrl })
        .eq("id", prototypeId),
    ]);

    send("done", { url: liveUrl, job_id: prototypeId, startup_name: startupName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    send("error", { message });
    if (prototypeId) {
      try {
        await supabaseAdmin.from("prototypes").update({ status: "failed" }).eq("id", prototypeId);
      } catch {
        /* best-effort status update */
      }
    }
  } finally {
    try {
      await writer.close();
    } catch {
      // Client disconnected.
    }
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/build/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          source_type?: BuildSourceType;
          opportunity_id?: string;
          source_idea_id?: string;
          email?: string;
          guest_id?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

        const sourceType = body.source_type ?? "opportunity";
        if (sourceType !== "opportunity" && sourceType !== "idea") {
          return new Response(
            JSON.stringify({ error: "source_type must be opportunity or idea" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (sourceType === "opportunity" && !body.opportunity_id) {
          return new Response(JSON.stringify({ error: "opportunity_id is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (sourceType === "idea" && !body.source_idea_id) {
          return new Response(JSON.stringify({ error: "source_idea_id is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let userId: string | null = null;
        let ownerType: "auth" | "guest" = "guest";
        let guestId: string | null = null;
        let email = body.email?.trim().toLowerCase() ?? "";

        if (token) {
          const {
            data: { user },
            error: userErr,
          } = await supabaseAdmin.auth.getUser(token);
          if (userErr || !user) {
            return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          userId = user.id;
          ownerType = "auth";
          email = email || user.email || "";
        } else {
          const guestIdentity = guestIdentityFromValues(email, body.guest_id);
          if (!guestIdentity) {
            return new Response(JSON.stringify({ error: "Valid guest id is required" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          email = guestIdentity.email ?? "";
          guestId = guestIdentity.guestId;
        }

        const { writable, readable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();

        runPipeline(
          writer,
          sourceType,
          body.opportunity_id,
          body.source_idea_id,
          email,
          userId,
          ownerType,
          guestId,
        ).catch(async (err: unknown) => {
          const enc = new TextEncoder();
          const msg = err instanceof Error ? err.message : "Internal error";
          try {
            await writer.write(
              enc.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`),
            );
            await writer.close();
          } catch {
            // Client disconnected.
          }
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
