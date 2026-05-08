import { createFileRoute } from "@tanstack/react-router";
import { createAnthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { serverEnv } from "@/lib/env.server";

function buildSystem(context: Record<string, unknown>): string {
  const base = `You are an expert startup analyst embedded in Untapt — a platform that surfaces unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt.

Your job: help founders evaluate opportunities, think through GTM, identify competitors, size markets, and plan MVPs. Be direct, specific, and numerical. Avoid generic advice.`;

  if (context?.type === "opportunity" && context?.opportunity) {
    const o = context.opportunity as Record<string, unknown>;
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
Research evidence: ${JSON.stringify(o.sources_detail)}

Answer questions in the context of THIS opportunity. Keep responses under 180 words unless asked for depth. Lead with insight, not caveats.`;
  }

  if (context?.type === "business" && context?.idea) {
    const idea = context.idea as Record<string, unknown>;
    const prototype = (context.prototype ?? null) as Record<string, unknown> | null;
    return `${base}

CURRENT PRIVATE BUSINESS THE USER IS BUILDING:
Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}
Video URL: ${idea.video_url}
Files: ${JSON.stringify(idea.files)}
Research results / market signals: ${JSON.stringify(idea.research_results)}
Linked prototype: ${JSON.stringify(prototype)}

Answer questions in the context of THIS saved business idea, not the general Explore page. Treat public opportunities as supporting market evidence only. Help the user pick the market, understand competitors, choose the first ICP, refine MVP scope, and decide what to build next. Keep responses under 180 words unless asked for depth.`;
  }

  if (context?.type === "feed") {
    const parts = [
      `${base}

The user is browsing the opportunity feed.`,
    ];
    if (context?.query) parts.push(`They searched for: "${context.query}"`);
    if (context?.filter && context.filter !== "all") parts.push(`Active filter: ${context.filter}`);
    parts.push(
      `Help them find the right opportunity, explain what makes one worth pursuing, or discuss startup strategy generally. Keep responses concise.`,
    );
    return parts.join("\n");
  }

  if (context?.type === "explore") {
    const parts = [
      `${base}

The user is in the Explore tab, where they can search all saved opportunity records and run deeper web research.`,
    ];
    if (context?.query) parts.push(`Current search: "${context.query}"`);
    if (context?.mode)
      parts.push(
        `Current mode: ${context.mode === "saved" ? "saved opportunity search" : "web research pipeline"}`,
      );
    if (typeof context?.resultCount === "number")
      parts.push(`Visible results: ${context.resultCount}`);
    if (Array.isArray(context?.opportunities) && context.opportunities.length > 0) {
      parts.push(`Top visible opportunities:\n${JSON.stringify(context.opportunities, null, 2)}`);
    }
    parts.push(
      `Help the user research companies, buyer pain, data/market angles, and startup ideas from this context. Use the source snippets and URLs attached to each visible opportunity as research evidence. If they ask for a company or idea not in the visible results, reason from the search intent and suggest what to investigate next. Keep responses concise unless asked for depth.`,
    );
    return parts.join("\n\n");
  }

  return `${base}\n\nHelp the user explore startup opportunities and evaluate which ones are worth pursuing.`;
}

export const Route = createFileRoute("/api/agent/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages: UIMessage[];
          context?: Record<string, unknown>;
        };
        const anthropic = createAnthropic({ apiKey: serverEnv("ANTHROPIC_API_KEY") });

        const result = await streamText({
          model: anthropic("claude-sonnet-4-6"),
          system: buildSystem(body.context ?? {}),
          messages: await convertToModelMessages(body.messages ?? []),
          maxOutputTokens: 700,
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
