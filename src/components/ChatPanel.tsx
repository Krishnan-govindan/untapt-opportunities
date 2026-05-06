import { useEffect, useRef, useState } from "react";
import type { Opportunity } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "What's the best GTM strategy?",
  "How big is this market really?",
  "Who are the real competitors?",
];

function getSessionId(): string {
  const key = "untapt-session-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

// ── Offline fallback ──────────────────────────────────────────────────────────
// Used when /api/chat is unavailable (local dev, API key not configured, etc.)

function fallbackResponse(message: string, opp: Opportunity): string {
  const q = message.toLowerCase();
  const compNames = opp.competitors.map((c) => c.name).join(", ");
  const compPricing = opp.competitors.map((c) => `${c.name} (${c.pricing})`).join(", ");
  const features = opp.mvp_features.slice(0, 3).join("; ");

  if (q.includes("gtm") || q.includes("go.to.market") || q.includes("growth") || q.includes("acquire") || q.includes("customer")) {
    return `Best GTM for this is a bottom-up PLG motion targeting ${opp.icp.split(",")[0]}. Start with a free tier that delivers immediate value on the core pain ("${opp.pain_summary.slice(0, 60)}…"), then upsell to teams. ${opp.why_now} Use Reddit, LinkedIn, and niche communities where your ICP already hangs out — they're already complaining about this problem.`;
  }
  if (q.includes("market") || q.includes("tam") || q.includes("size") || q.includes("big") || q.includes("revenue")) {
    return `TAM is ${opp.tam_estimate}. Urgency score is ${opp.urgency_score}/10 — that's unusually high. ${opp.why_now} Even capturing 1% of this market puts you at a meaningful revenue base. The real question is SAM: how many ${opp.icp.split(",")[0]} can you realistically reach in year 1?`;
  }
  if (q.includes("competitor") || q.includes("alternative") || q.includes("competition") || q.includes("vs ")) {
    return `Main alternatives are ${compPricing}. Their gap: they're built for enterprises, not ${opp.icp.split(",")[0]}. Your wedge is price-point + workflow fit. ${opp.competitors[0] ? `${opp.competitors[0].name}'s pricing alone prices out most of your ICP.` : ""} Win on simplicity and time-to-value.`;
  }
  if (q.includes("mvp") || q.includes("feature") || q.includes("build") || q.includes("v1") || q.includes("product")) {
    return `MVP scope: ${features}. Ship these three in week 1, everything else is noise. The key insight for ${opp.icp.split(",")[0]} is that they need outcome in <5 minutes — don't make them configure anything. Get 10 design partners from your ICP before writing a line of code.`;
  }
  if (q.includes("fundrais") || q.includes("investor") || q.includes("vc") || q.includes("raise") || q.includes("funding")) {
    return `With ${opp.tam_estimate} TAM and urgency score ${opp.urgency_score}/10, this is fundable at pre-seed. Story: timing (${opp.why_now.slice(0, 80)}…). Target founders who've felt this pain — they'll convert fastest. Raise $500K–$1.5M to get to 20 paying customers, then raise a proper seed.`;
  }
  if (q.includes("icp") || q.includes("who") || q.includes("target") || q.includes("customer")) {
    return `ICP: ${opp.icp}. These people are feeling the pain *right now* — ${opp.pain_summary}. Find them on LinkedIn by job title, or in subreddits/Slack communities where they congregate. First 10 customers should all come from personal outreach, not ads.`;
  }
  if (q.includes("why now") || q.includes("timing") || q.includes("trend")) {
    return opp.why_now + " That's the macro tailwind. Pair it with the collapse in AI inference costs and you have a rare timing window to build this at a fraction of what it would have cost 2 years ago.";
  }

  return `Great question about "${opp.title}". The core insight here is: ${opp.pain_summary}. ${opp.why_now} The ICP (${opp.icp.split(",")[0]}) is actively looking for a solution — existing tools like ${compNames} don't fit their workflow or budget. What specific aspect would you like to dig into?`;
}

// ── streaming fallback helper ─────────────────────────────────────────────────
async function* streamText(text: string): AsyncGenerator<string> {
  const words = text.split(" ");
  for (const word of words) {
    yield word + " ";
    await new Promise((r) => setTimeout(r, 28));
  }
}

export function ChatPanel({ opportunity }: { opportunity: Opportunity }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const history = messages
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }));

    setInput("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": getSessionId(),
        },
        body: JSON.stringify({
          opportunity_id: opportunity.id,
          message: text,
          history,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (currentEvent === "chunk") {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.streaming) {
                    next[next.length - 1] = {
                      ...last,
                      content: last.content + (data.text as string),
                    };
                  }
                  return next;
                });
              } else if (currentEvent === "done") {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.streaming) {
                    next[next.length - 1] = {
                      ...last,
                      content: data.text as string,
                      streaming: false,
                    };
                  }
                  return next;
                });
              } else if (currentEvent === "error") {
                throw new Error(data.message as string);
              }
            } catch (parseErr) {
              if (!(parseErr instanceof SyntaxError)) throw parseErr;
            }
            currentEvent = "";
          }
        }
      }
    } catch {
      // API unavailable — stream a smart fallback response word-by-word
      const answer = fallbackResponse(text, opportunity);
      for await (const chunk of streamText(answer)) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      }
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) next[next.length - 1] = { ...last, streaming: false };
        return next;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Ask the analyst</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Market · GTM · Competitors · MVP
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-muted-foreground">Try asking:</p>
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full rounded-lg border border-border bg-secondary px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-secondary text-foreground"
              }`}
            >
              {m.streaming && !m.content ? (
                <span className="flex gap-1 py-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </span>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask anything about this opportunity…"
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
