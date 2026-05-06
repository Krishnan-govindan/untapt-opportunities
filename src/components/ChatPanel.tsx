import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

const cannedResponses = (o: Opportunity, q: string): string => {
  const lower = q.toLowerCase();
  if (lower.includes("competit"))
    return `The main competitors are ${o.competitors
      .map((c) => `${c.name} (${c.pricing})`)
      .join(", ")}. None target ${o.icp.toLowerCase()} directly with the same wedge.`;
  if (lower.includes("market") || lower.includes("tam") || lower.includes("size"))
    return `TAM is approximately ${o.tam_estimate}. The ICP — ${o.icp} — represents the most acute pain segment. SAM is roughly 15–25% of TAM given the geographic and ACV constraints.`;
  if (lower.includes("mvp") || lower.includes("build") || lower.includes("feature"))
    return `For the MVP I'd start with: ${o.mvp_features
      .slice(0, 3)
      .map((f) => `(${f})`)
      .join(", ")}. Ship the rest in v2.`;
  if (lower.includes("why") || lower.includes("now"))
    return o.why_now;
  return `Good question. Based on the signals: ${o.pain_summary} ${o.why_now} The fastest path is a focused MVP for ${o.icp.toLowerCase()}.`;
};

export function ChatPanel({ opportunity }: { opportunity: Opportunity }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        supabase
          .from("chats")
          .select("role,content")
          .eq("opportunity_id", opportunity.id)
          .eq("user_id", uid)
          .order("created_at")
          .then(({ data: rows }) => {
            if (rows) setMessages(rows as Msg[]);
          });
      }
    });
  }, [opportunity.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);

    if (userId) {
      await supabase.from("chats").insert({
        opportunity_id: opportunity.id,
        user_id: userId,
        role: "user",
        content: text,
      });
    }

    // Simulate streaming
    const full = cannedResponses(opportunity, text);
    const tokens = full.split(/(\s+)/);
    let acc = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    for (const tok of tokens) {
      acc += tok;
      await new Promise((r) => setTimeout(r, 25));
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: acc };
        return copy;
      });
    }
    setStreaming(false);
    if (userId) {
      await supabase.from("chats").insert({
        opportunity_id: opportunity.id,
        user_id: userId,
        role: "assistant",
        content: full,
      });
    }
  };

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Ask anything about this opportunity</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {userId ? "Chat is saved to your account" : "Sign in to save chats"}
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            {["What's the TAM?", "Who are the competitors?", "What should the MVP include?"].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="block w-full rounded-md border border-border bg-secondary px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </button>
              ),
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
          >
            {m.content}
            {streaming && i === messages.length - 1 && m.role === "assistant" && (
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-foreground align-middle" />
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask…"
            className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
