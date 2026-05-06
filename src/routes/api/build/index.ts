import { createAPIFileRoute } from '@tanstack/react-start/api'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function nanoid(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 28)
    .replace(/-+$/, '')
}

function toStartupName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function cleanUrl(url: string): string {
  return url.startsWith('https://') ? url : `https://${url}`
}

// ─── TSX Validation ───────────────────────────────────────────────────────────

function isValidTSX(code: string): boolean {
  if (code.length < 1500) return false
  if (!code.includes('export default function')) return false
  if (!/<[A-Za-z]/.test(code)) return false
  const lower = code.toLowerCase()
  if (lower.includes('// todo') || lower.includes('// fixme') || lower.includes('// placeholder'))
    return false
  if ((code.match(/\.\.\./g) ?? []).length > 3) return false
  return true
}

function extractCode(raw: string): string {
  const fence = raw.match(/```(?:tsx?|jsx?)?\n([\s\S]+?)\n```/)
  if (fence) return fence[1].trim()
  const start = raw.search(/^(?:'use client'|"use client"|import\s|export\s+default)/m)
  if (start >= 0) return raw.slice(start).trim()
  return raw.trim()
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
- NO external imports. NO React import. Inline Tailwind ONLY.`

async function generatePageTSX(
  opp: Record<string, unknown>,
  strict = false
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const strictNote = strict
    ? `CRITICAL: Your previous attempt was invalid. Output ONLY valid TypeScript code.
No markdown, no backticks, no preamble, no ellipsis (...), no placeholder comments.
Every section must be COMPLETE with real content derived from the opportunity data.\n\n`
    : ''

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    system: `${strictNote}${SYSTEM_PROMPT}`,
    messages: [
      {
        role: 'user',
        content: `Generate the complete landing page for this startup opportunity:

${JSON.stringify(opp, null, 2)}

Name the startup based on the title. Derive all copy, features, and competitive positioning from the opportunity data.`,
      },
    ],
  })

  const raw = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  return extractCode(raw)
}

// ─── Vercel Deployment ────────────────────────────────────────────────────────

function buildVercelFiles(
  pageTSX: string,
  projectName: string,
  startupName: string,
  description: string
) {
  const pkg = JSON.stringify(
    {
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: {
        next: '15.1.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        '@types/node': '^22',
        '@types/react': '^19',
        '@types/react-dom': '^19',
        typescript: '^5',
        tailwindcss: '^3.4.1',
        autoprefixer: '^10.4.20',
        postcss: '^8',
      },
    },
    null,
    2
  )

  const safeTitle = startupName.replace(/'/g, "\\'")
  const safeDesc = description.replace(/'/g, "\\'").slice(0, 160)

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
}`

  const tsconfig = JSON.stringify(
    {
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    },
    null,
    2
  )

  return [
    { file: 'package.json', data: pkg },
    { file: 'next.config.js', data: 'module.exports = {}' },
    {
      file: 'tailwind.config.js',
      data: `module.exports = { content: ['./app/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }`,
    },
    {
      file: 'postcss.config.js',
      data: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }`,
    },
    { file: 'tsconfig.json', data: tsconfig },
    {
      file: 'app/globals.css',
      data: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
    },
    { file: 'app/layout.tsx', data: layout },
    { file: 'app/page.tsx', data: pageTSX },
  ]
}

async function deployToVercel(
  files: Array<{ file: string; data: string }>,
  projectName: string
): Promise<{ id: string; url: string }> {
  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      files: files.map((f) => ({ ...f, encoding: 'utf-8' })),
      projectSettings: { framework: 'nextjs', nodeVersion: '22.x' },
      target: 'production',
    }),
  })

  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const errMsg =
      (body.error as Record<string, string> | undefined)?.message ?? JSON.stringify(body)
    throw new Error(`Vercel deploy failed: ${errMsg}`)
  }

  return { id: body.id as string, url: cleanUrl(body.url as string) }
}

async function pollUntilReady(deploymentId: string): Promise<string> {
  for (let i = 0; i < 36; i++) {
    await sleep(5_000)
    const res = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    })
    const data = (await res.json()) as Record<string, unknown>
    const state = (data.readyState ?? data.state) as string | undefined
    if (state === 'READY') return cleanUrl(data.url as string)
    if (state === 'ERROR' || state === 'CANCELED') {
      throw new Error(`Deployment ${state}: ${(data.errorMessage as string) ?? ''}`)
    }
  }
  throw new Error('Deployment timed out after 3 minutes')
}

// ─── Email ────────────────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  url: string,
  startupName: string,
  opp: Record<string, unknown>
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Untapt <onboarding@resend.dev>',
      to: [to],
      subject: `Your prototype is live: ${startupName}`,
      html: `
        <div style="font-family:monospace;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e2e8f0;padding:32px;border-radius:12px;">
          <h1 style="color:#a855f7;font-size:22px;margin:0 0 6px;">Your prototype is live.</h1>
          <p style="color:#94a3b8;margin:0 0 24px;font-size:13px;">Built in 47 seconds by Pain Point Arbitrage.</p>
          <a href="${url}" style="display:inline-block;background:linear-gradient(to right,#7c3aed,#a855f7);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View your prototype →</a>
          <div style="margin-top:28px;padding:16px;background:#111827;border-radius:8px;border:1px solid #1f2937;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">Opportunity</p>
            <p style="margin:0 0 4px;color:#e2e8f0;font-weight:600;">${startupName}</p>
            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">${String(opp.pain_summary ?? '')}</p>
            <p style="margin:0;color:#6b7280;font-size:12px;">TAM: ${String(opp.tam_estimate ?? '?')} · Urgency: ${opp.urgency_score}/10</p>
          </div>
          <p style="margin-top:20px;color:#4b5563;font-size:11px;">Untapt — surfaces unmonetized startup opportunities</p>
        </div>`,
    }),
  }).catch(() => {}) // email failure never kills the build
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

async function runPipeline(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  opportunityId: string,
  email: string
): Promise<void> {
  const enc = new TextEncoder()
  const send = (event: string, data: object) => {
    try {
      writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    } catch {
      // client disconnected — ignore
    }
  }

  let prototypeId: string | undefined

  try {
    // ── 1. Create prototype row ──────────────────────────────────────────────
    send('status', { step: 'researching', message: 'Setting up build job…' })

    const { data: proto, error: protoErr } = await supabaseAdmin
      .from('prototypes')
      .insert({
        user_id: crypto.randomUUID(),
        opportunity_id: opportunityId,
        name: 'Generating…',
        email,
        status: 'researching',
      })
      .select('id')
      .single()

    if (protoErr || !proto) throw new Error('Failed to create prototype record')
    prototypeId = proto.id
    send('job_id', { job_id: prototypeId })

    // ── 2. Fetch opportunity ─────────────────────────────────────────────────
    send('status', { step: 'researching', message: 'Fetching opportunity data…' })

    const { data: opp, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .maybeSingle()

    if (oppErr || !opp) throw new Error('Opportunity not found')

    const slug = toSlug(opp.title)
    const startupName = toStartupName(slug)

    await supabaseAdmin
      .from('prototypes')
      .update({ name: startupName })
      .eq('id', prototypeId)

    // ── 3. Generate with Claude ──────────────────────────────────────────────
    send('status', { step: 'designing', message: 'Claude is writing your landing page…' })
    await supabaseAdmin
      .from('prototypes')
      .update({ status: 'designing' })
      .eq('id', prototypeId)

    let pageTSX = await generatePageTSX(opp as Record<string, unknown>)

    if (!isValidTSX(pageTSX)) {
      send('status', { step: 'designing', message: 'Refining the design (attempt 2)…' })
      pageTSX = await generatePageTSX(opp as Record<string, unknown>, true)
      if (!isValidTSX(pageTSX)) throw new Error('Claude produced invalid TSX after two attempts')
    }

    // ── 4. Deploy to Vercel ──────────────────────────────────────────────────
    send('status', { step: 'deploying', message: 'Uploading files to Vercel…' })
    await supabaseAdmin
      .from('prototypes')
      .update({ status: 'deploying' })
      .eq('id', prototypeId)

    const projectName = `pain-${slug}-${nanoid()}`
    const files = buildVercelFiles(
      pageTSX,
      projectName,
      startupName,
      String(opp.pain_summary ?? '')
    )

    let deploymentId: string
    try {
      const result = await deployToVercel(files, projectName)
      deploymentId = result.id
    } catch {
      send('status', { step: 'deploying', message: 'Retrying deployment…' })
      await sleep(3_000)
      const result = await deployToVercel(files, projectName)
      deploymentId = result.id
    }

    // ── 5. Poll until ready ──────────────────────────────────────────────────
    send('status', { step: 'deploying', message: 'Waiting for deployment to go live…' })
    const liveUrl = await pollUntilReady(deploymentId)

    // ── 6. Email + finalize ──────────────────────────────────────────────────
    send('status', { step: 'deploying', message: 'Sending you the link…' })

    await Promise.all([
      sendEmail(email, liveUrl, startupName, opp as Record<string, unknown>),
      supabaseAdmin
        .from('prototypes')
        .update({ status: 'deployed', deployed_url: liveUrl })
        .eq('id', prototypeId),
    ])

    send('done', { url: liveUrl, job_id: prototypeId, startup_name: startupName })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    send('error', { message })
    if (prototypeId) {
      await supabaseAdmin
        .from('prototypes')
        .update({ status: 'failed' })
        .eq('id', prototypeId)
        .catch(() => {})
    }
  } finally {
    try {
      await writer.close()
    } catch {}
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const APIRoute = createAPIFileRoute('/api/build')({
  POST: async ({ request }) => {
    let body: { opportunity_id?: string; email?: string }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { opportunity_id, email } = body
    if (!opportunity_id || !email) {
      return new Response(
        JSON.stringify({ error: 'opportunity_id and email are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { writable, readable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()

    runPipeline(writer, opportunity_id, email).catch(async (err: unknown) => {
      const enc = new TextEncoder()
      const msg = err instanceof Error ? err.message : 'Internal error'
      try {
        await writer.write(
          enc.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`)
        )
        await writer.close()
      } catch {}
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  },
})
