import { createAPIFileRoute } from '@tanstack/react-start/api'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

function systemPrompt(opportunityJson: string): string {
  return `You are an expert venture analyst helping a founder evaluate this specific opportunity:

${opportunityJson}

Answer questions about market size, GTM strategy, competitors, MVP scope, fundraising path. Be specific and numerical. If asked something outside this opportunity, redirect politely. Keep responses under 150 words unless asked for depth.`
}

export const APIRoute = createAPIFileRoute('/api/chat')({
  POST: async ({ request }) => {
    let body: {
      opportunity_id?: string
      message?: string
      history?: Array<{ role: string; content: string }>
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { opportunity_id, message, history = [] } = body
    if (!opportunity_id || !message) {
      return new Response(
        JSON.stringify({ error: 'opportunity_id and message are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const sessionId = request.headers.get('X-Session-Id') ?? crypto.randomUUID()

    const { data: opp, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', opportunity_id)
      .maybeSingle()

    if (oppErr || !opp) {
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    const { writable, readable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    const enc = new TextEncoder()

    const send = (event: string, data: object) => {
      try {
        writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      } catch {}
    }

    ;(async () => {
      let fullText = ''
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 1024,
          system: systemPrompt(JSON.stringify(opp, null, 2)),
          messages,
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullText += chunk.delta.text
            send('chunk', { text: chunk.delta.text })
          }
        }

        send('done', { text: fullText })

        // Save exchange — fire and forget, never block the response
        supabaseAdmin
          .from('chats')
          .insert([
            { user_id: sessionId, opportunity_id, role: 'user', content: message },
            { user_id: sessionId, opportunity_id, role: 'assistant', content: fullText },
          ])
          .catch(() => {})
      } catch (err: unknown) {
        send('error', { message: err instanceof Error ? err.message : 'Chat error' })
      } finally {
        try {
          await writer.close()
        } catch {}
      }
    })()

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
