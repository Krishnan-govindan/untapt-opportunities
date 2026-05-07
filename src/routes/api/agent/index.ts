import { createAPIFileRoute } from '@tanstack/react-start/api'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

function buildSystem(context: Record<string, unknown>): string {
  const base = `You are an expert startup analyst embedded in Untapt — a platform that surfaces unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt.

Your job: help founders evaluate opportunities, think through GTM, identify competitors, size markets, and plan MVPs. Be direct, specific, and numerical. Avoid generic advice.`

  if (context?.type === 'opportunity' && context?.opportunity) {
    const o = context.opportunity as Record<string, unknown>
    return `${base}

CURRENT OPPORTUNITY THE USER IS VIEWING:
Title: ${o.title}
Pain: ${o.pain_summary}
TAM: ${o.tam_estimate}
Urgency: ${o.urgency_score}/10
ICP: ${o.icp}
Pain description: ${o.pain_description}
Why now: ${o.why_now}
Competitors: ${JSON.stringify(o.competitors)}
MVP features: ${JSON.stringify(o.mvp_features)}
Sources: ${JSON.stringify(o.sources)}

Answer questions in the context of THIS opportunity. Keep responses under 180 words unless asked for depth. Lead with insight, not caveats.`
  }

  if (context?.type === 'feed') {
    const parts = [`${base}

The user is browsing the opportunity feed.`]
    if (context?.query) parts.push(`They searched for: "${context.query}"`)
    if (context?.filter && context.filter !== 'all') parts.push(`Active filter: ${context.filter}`)
    parts.push(`Help them find the right opportunity, explain what makes one worth pursuing, or discuss startup strategy generally. Keep responses concise.`)
    return parts.join('\n')
  }

  return `${base}\n\nHelp the user explore startup opportunities and evaluate which ones are worth pursuing.`
}

export const APIRoute = createAPIFileRoute('/api/agent')({
  POST: async ({ request }) => {
    const body = await request.json() as {
      messages: Array<{ role: string; content: string }>
      context?: Record<string, unknown>
    }

    const result = await streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: buildSystem(body.context ?? {}),
      messages: body.messages as Parameters<typeof streamText>[0]['messages'],
      maxTokens: 512,
    })

    return result.toDataStreamResponse()
  },
})
