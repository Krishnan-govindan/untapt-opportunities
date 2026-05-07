import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { useAgent } from "@/lib/agent-context";

const STARTERS: Record<string, string[]> = {
  opportunity: [
    "What's the fastest GTM for this?",
    "How defensible is this vs competitors?",
    "What would a $500K seed deck say?",
    "Give me the 3-week MVP plan",
  ],
  feed: [
    "Which opportunity has the best risk/reward?",
    "What makes a $B+ TAM actually reachable?",
    "Help me compare two opportunities",
    "What sectors are heating up right now?",
  ],
  default: [
    "What makes an opportunity worth pursuing?",
    "How do I validate a B2B SaaS idea fast?",
    "Explain urgency score",
  ],
};

function ContextBadge({ type }: { type: string | undefined }) {
  if (!type) return null;
  const labels: Record<string, { emoji: string; text: string; cls: string }> = {
    opportunity: { emoji: "📊", text: "Opportunity context", cls: "badge-urgent" },
    feed:        { emoji: "📡", text: "Feed context", cls: "badge-multi" },
    demo:        { emoji: "🧪", text: "Demo context", cls: "badge-tam" },
  };
  const b = labels[type];
  if (!b) return null;
  return (
    <span className={`category-badge ${b.cls} text-[10px]`}>
      {b.emoji} {b.text}
    </span>
  );
}

export function AgentSidebar() {
  const { isOpen, setOpen, pageContext } = useAgent();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const starters = STARTERS[pageContext?.type ?? "default"] ?? STARTERS.default;

  const { messages, input = "", setInput, append, handleSubmit, status, setMessages } = useChat({
    api: "/api/agent",
    body: { context: pageContext ?? undefined },
    id: pageContext?.type === "opportunity"
      ? `opp-${(pageContext as { opportunity: { id: string } }).opportunity?.id}`
      : "global",
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  // ⌘K / Ctrl+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v: boolean) => !v);
      }
    };
    window.addEventListener("keydown", handler as EventListener);
    return () => window.removeEventListener("keydown", handler as EventListener);
  }, [setOpen]);

  // Reset chat when page context changes
  useEffect(() => {
    setMessages([]);
  }, [
    pageContext?.type,
    pageContext?.type === "opportunity"
      ? (pageContext as { opportunity: { id: string } }).opportunity?.id
      : null,
    setMessages,
  ]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  const send = (text?: string) => {
    const content = text ?? input.trim();
    if (!content || isLoading) return;
    setInput("");
    append({ role: "user", content });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[380px] max-w-[95vw] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
              <span className="text-sm font-semibold">Untapt Agent</span>
            </div>
            <ContextBadge type={pageContext?.type} />
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="rounded px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                title="Clear chat"
              >
                clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              title="Close (Esc)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context pill (opportunity) */}
        {pageContext?.type === "opportunity" && (
          <div className="border-b border-border bg-secondary/40 px-4 py-2.5">
            <p className="truncate text-xs font-medium text-foreground">
              {(pageContext as { opportunity: { title: string } }).opportunity.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              TAM {(pageContext as { opportunity: { tam_estimate: string } }).opportunity.tam_estimate}
              {" · "}URG {(pageContext as { opportunity: { urgency_score: number } }).opportunity.urgency_score}/10
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-muted-foreground">Try asking:</p>
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-lg border border-border bg-secondary px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="mr-2 mt-1 h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white">U</span>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-secondary text-foreground"
                }`}
              >
                {m.content || (
                  <span className="flex gap-1 py-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything… (⏎ send, ⇧⏎ newline)"
              disabled={isLoading}
              rows={1}
              className="agent-textarea flex-1 resize-none rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
              style={{ maxHeight: 120 }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="mb-0.5 rounded-xl bg-primary p-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
          <p className="mt-1.5 text-center font-mono text-[9px] text-muted-foreground">
            ⌘K to open · Esc to close
          </p>
        </div>
      </aside>
    </>
  );
}
