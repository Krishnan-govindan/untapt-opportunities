import { createFileRoute } from "@tanstack/react-router";
import Anthropic from "@anthropic-ai/sdk";
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

// ─── TSX Validation ───────────────────────────────────────────────────────────

function isValidTSX(code: string): boolean {
  if (code.length < 1500) return false;
  if (!code.includes("export default function")) return false;
  if (!/<[A-Za-z]/.test(code)) return false;
  const lower = code.toLowerCase();
  if (lower.includes("// todo") || lower.includes("// fixme") || lower.includes("// placeholder"))
    return false;
  if ((code.match(/\.\.\./g) ?? []).length > 3) return false;
  return true;
}

function extractCode(raw: string): string {
  const fence = raw.match(/```(?:tsx?|jsx?)?\n([\s\S]+?)\n```/);
  if (fence) return fence[1].trim();
  const start = raw.search(/^(?:'use client'|"use client"|import\s|export\s+default)/m);
  if (start >= 0) return raw.slice(start).trim();
  return raw.trim();
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

function extractJSON(raw: string): BusinessContext {
  const cleaned = raw.trim();
  try {
    return JSON.parse(cleaned) as BusinessContext;
  } catch {
    // Try fenced JSON below.
  }
  const fence = cleaned.match(/```(?:json)?\n?([\s\S]+?)\n?```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as BusinessContext;
    } catch {
      // Try loose object extraction below.
    }
  }
  const objMatch = cleaned.match(/\{[\s\S]+\}/);
  if (objMatch) {
    return JSON.parse(objMatch[0]) as BusinessContext;
  }
  throw new Error("No valid JSON found in strategy response");
}

function fallbackStrategy(opp: Record<string, unknown>, startupName: string): BusinessContext {
  const mvp = (opp.mvp_features as string[] | undefined) ?? [];
  return {
    mission: `We help ${String(opp.icp ?? "professionals")} eliminate ${String(opp.pain_summary ?? "their core pain point")}`,
    vision: `A world where ${String(opp.title ?? "this problem")} is no longer a barrier to progress`,
    tagline: startupName,
    value_prop: String(opp.pain_description ?? opp.pain_summary ?? ""),
    gtm_strategy: mvp.slice(0, 4).map((f, i) => `${i + 1}. Launch with ${f}`) as string[],
    icp_refined: String(opp.icp ?? ""),
  };
}

async function generateBusinessStrategy(
  opp: Record<string, unknown>,
  startupName: string,
): Promise<BusinessContext> {
  const anthropic = new Anthropic({ apiKey: serverEnv("ANTHROPIC_API_KEY") });

  const payload = {
    title: opp.title,
    pain_summary: opp.pain_summary,
    icp: opp.icp,
    why_now: opp.why_now,
    tam_estimate: opp.tam_estimate,
    competitors: opp.competitors,
    mvp_features: opp.mvp_features,
  };

  const tryGenerate = async (strict: boolean): Promise<BusinessContext> => {
    const strictNote = strict
      ? "CRITICAL: Respond ONLY with the JSON object. No text before or after it.\n\n"
      : "";
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: `${strictNote}You are a startup business strategist. Respond with ONLY a valid JSON object matching this exact shape — no markdown, no backticks, no explanation:
{
  "mission": "We [action] [who] [outcome] — one sentence, present tense",
  "vision": "A world where [future state] — one sentence",
  "tagline": "5-8 punchy words, no buzzwords like platform or solution",
  "value_prop": "2 sentences max. Lead with customer outcome, not features.",
  "gtm_strategy": ["step 1", "step 2", "step 3", "step 4"],
  "icp_refined": "2-3 sentences. Specific job titles, company sizes, pain triggers."
}`,
      messages: [
        {
          role: "user",
          content: `Generate startup business context for "${startupName}":\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return extractJSON(raw);
  };

  try {
    return await tryGenerate(false);
  } catch {
    try {
      return await tryGenerate(true);
    } catch {
      return fallbackStrategy(opp, startupName);
    }
  }
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

// ─── Claude Generation ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are generating a production Next.js 15 App Router landing page component.

OUTPUT FORMAT: TypeScript/JSX code ONLY. No markdown. No backticks. No explanation.
Start your output directly with: export default function Page() {
End with the final closing brace.

REQUIRED SECTIONS (all fully implemented with real copy — NO placeholders):
1. Nav: logo (startup name) + "Get early access" CTA button
2. Hero: large gradient headline, subheadline, email input + CTA, social proof line
3. Problem: 3 pain-point cards with large emoji icons
4. Solution: How this product solves the problem
5. Features: Exactly 3 feature blocks (emoji, bold title, 2-sentence description)
6. Competitors: Table comparing this product vs 2-3 competitors (use the competitors data)
7. Pricing: 3 tiers (Starter/Growth/Enterprise) with feature lists and monthly USD prices
8. Founder CTA: Compelling 2-paragraph pitch with email signup
9. FAQ: 5 Q&A pairs using <details>/<summary> HTML elements
10. Footer: copyright + "Built by Untapt"

DESIGN RULES:
- Dark mode only: bg-gray-950 page background, bg-gray-900 cards
- Gradient accent: from-violet-500 to-purple-600
- Cards: rounded-2xl border border-white/10 bg-gray-900 shadow-xl
- Buttons: bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl px-6 py-3
- Typography: text-white headings, text-gray-400 body
- Fully responsive using Tailwind sm:/md: breakpoints
- NO external imports. NO React import. Inline Tailwind ONLY.`;

async function generatePageTSX(opp: Record<string, unknown>, strict = false): Promise<string> {
  const anthropic = new Anthropic({ apiKey: serverEnv("ANTHROPIC_API_KEY") });

  const strictNote = strict
    ? `CRITICAL: Your previous attempt was invalid. Output ONLY valid TypeScript code.
No markdown, no backticks, no preamble, no ellipsis (...), no placeholder comments.
Every section must be COMPLETE with real content derived from the opportunity data.\n\n`
    : "";

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8192,
    system: `${strictNote}${SYSTEM_PROMPT}`,
    messages: [
      {
        role: "user",
        content: `Generate the complete landing page for this startup opportunity:

${JSON.stringify(opp, null, 2)}

Name the startup based on the title. Derive all copy, features, and competitive positioning from the opportunity data.`,
      },
    ],
  });

  const raw = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return extractCode(raw);
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
        next: "15.1.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
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

async function runPipeline(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  opportunityId: string,
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
    // ── 1. Create prototype row ──────────────────────────────────────────────
    send("status", { step: "researching", message: "Setting up build job…" });

    const { data: proto, error: protoErr } = await supabaseAdmin
      .from("prototypes")
      .insert({
        user_id: userId,
        owner_type: ownerType,
        owner_email: email || null,
        guest_id: guestId ?? null,
        opportunity_id: opportunityId,
        name: "Generating…",
        email,
        status: "researching",
      })
      .select("id")
      .single();

    if (protoErr || !proto) throw new Error("Failed to create prototype record");
    prototypeId = proto.id;
    send("job_id", { job_id: prototypeId });

    // ── 2. Fetch opportunity ─────────────────────────────────────────────────
    send("status", { step: "researching", message: "Fetching opportunity data…" });

    const { data: opp, error: oppErr } = await supabaseAdmin
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .maybeSingle();

    if (oppErr || !opp) throw new Error("Opportunity not found");

    const slug = toSlug(opp.title);
    const startupName = toStartupName(slug);

    await supabaseAdmin.from("prototypes").update({ name: startupName }).eq("id", prototypeId);

    // ── 2.5. Generate business strategy ─────────────────────────────────────
    send("status", { step: "strategizing", message: "Crafting your business strategy…" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any)
      .from("prototypes")
      .update({ status: "strategizing" })
      .eq("id", prototypeId)
      .then(
        () => {},
        () => {},
      );

    const context = await generateBusinessStrategy(opp as Record<string, unknown>, startupName);

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

    // ── 3. Generate with Claude ──────────────────────────────────────────────
    send("status", { step: "designing", message: "Claude is writing your landing page…" });
    await supabaseAdmin.from("prototypes").update({ status: "designing" }).eq("id", prototypeId);

    let pageTSX = await generatePageTSX(opp as Record<string, unknown>);

    if (!isValidTSX(pageTSX)) {
      send("status", { step: "designing", message: "Refining the design (attempt 2)…" });
      pageTSX = await generatePageTSX(opp as Record<string, unknown>, true);
      if (!isValidTSX(pageTSX)) throw new Error("Claude produced invalid TSX after two attempts");
    }

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
      email
        ? sendEmail(email, liveUrl, startupName, opp as Record<string, unknown>, context)
        : Promise.resolve(),
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
        await supabaseAdmin
          .from("prototypes")
          .update({ status: "failed" })
          .eq("id", prototypeId);
      } catch { /* best-effort status update */ }
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
        let body: { opportunity_id?: string; email?: string; guest_id?: string };
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

        const { opportunity_id } = body;
        if (!opportunity_id) {
          return new Response(JSON.stringify({ error: "opportunity_id is required" }), {
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
            return new Response(JSON.stringify({ error: "Valid guest email is required" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          email = guestIdentity.email;
          guestId = guestIdentity.guestId;
        }

        const { writable, readable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();

        runPipeline(writer, opportunity_id, email, userId, ownerType, guestId).catch(async (err: unknown) => {
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
