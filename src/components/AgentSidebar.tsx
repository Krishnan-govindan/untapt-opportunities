import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAgent, type PageContext } from "@/lib/agent-context";
import type { SourceDetail } from "@/lib/types";

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
  explore: [
    "Find companies that could sell data to labs",
    "What angles should I research next?",
    "Which visible result has the strongest buyer?",
    "Turn this search into a startup thesis",
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
    feed: { emoji: "📡", text: "Feed context", cls: "badge-multi" },
    explore: { emoji: "🔎", text: "Explore context", cls: "badge-multi" },
    demo: { emoji: "🧪", text: "Demo context", cls: "badge-tam" },
  };
  const b = labels[type];
  if (!b) return null;
  return (
    <span className={`category-badge ${b.cls} text-[10px]`}>
      {b.emoji} {b.text}
    </span>
  );
}

function textFromMessage(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function storedMessages(chatId: string): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`untapt-agent:${chatId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function storageKey(chatId: string): string {
  return `untapt-agent:${chatId}`;
}

function chatIdForContext(pageContext: PageContext | null): string {
  if (pageContext?.type === "opportunity") return `opp-${pageContext.opportunity.id}`;
  if (pageContext?.type === "explore") return `explore-${pageContext.query ?? "blank"}`;
  if (pageContext?.type === "feed") {
    return `feed-${pageContext.query ?? "all"}-${pageContext.filter ?? "all"}`;
  }
  if (pageContext?.type === "demo") return `demo-${pageContext.opportunity.id}`;
  return "global";
}

function sourceLabel(source: SourceDetail): string {
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.platform;
  }
}

function ResearchSources({ sources }: { sources?: SourceDetail[] }) {
  const visible = (sources ?? []).filter((source) => source.snippet || source.url).slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {visible.map((source, index) => (
        <a
          key={`${source.url}-${index}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md border border-border bg-background/40 px-2 py-1.5 hover:border-primary/40"
        >
          <span className="block truncate font-mono text-[9px] text-primary">
            {sourceLabel(source)}
          </span>
          {source.snippet && (
            <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted-foreground">
              {source.snippet}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function ResearchContext({ pageContext }: { pageContext: PageContext | null }) {
  if (pageContext?.type === "opportunity") {
    if (!pageContext.opportunity.sources_detail?.length) return null;

    return (
      <div className="border-b border-border bg-secondary/25 px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Research
        </p>
        <ResearchSources sources={pageContext.opportunity.sources_detail} />
      </div>
    );
  }

  if (pageContext?.type !== "explore" || !pageContext.opportunities?.length) return null;

  return (
    <div className="max-h-72 overflow-y-auto border-b border-border bg-secondary/25 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Research by idea
        </p>
        {typeof pageContext.resultCount === "number" && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {pageContext.resultCount} found
          </span>
        )}
      </div>
      <div className="space-y-3">
        {pageContext.opportunities.slice(0, 5).map((opportunity) => (
          <div key={opportunity.id} className="rounded-md border border-border bg-card/60 p-2">
            <p className="truncate text-xs font-medium text-foreground">{opportunity.title}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              {opportunity.pain_summary}
            </p>
            <div className="mt-2">
              <ResearchSources sources={opportunity.sources_detail} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentSidebar() {
  const { isOpen, setOpen, pageContext } = useAgent();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const starters = STARTERS[pageContext?.type ?? "default"] ?? STARTERS.default;
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent" }), []);
  const chatId = chatIdForContext(pageContext);
  const initialMessages = useMemo(() => storedMessages(chatId), [chatId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    id: chatId,
    messages: initialMessages,
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

  // Keep chat history persistent per context.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length === 0) {
      window.localStorage.removeItem(storageKey(chatId));
      return;
    }
    window.localStorage.setItem(storageKey(chatId), JSON.stringify(messages));
  }, [chatId, messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  const send = (text?: string) => {
    const content = text ?? input.trim();
    if (!content || isLoading) return;
    setInput("");
    void sendMessage({ text: content }, { body: { context: pageContext ?? undefined } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
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
                onClick={() => {
                  setMessages([]);
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem(storageKey(chatId));
                  }
                }}
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context pill (opportunity) */}
        {pageContext?.type === "opportunity" && (
          <div className="border-b border-border bg-secondary/40 px-4 py-2.5">
            <p className="truncate text-xs font-medium text-foreground">
              {pageContext.opportunity.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              TAM {pageContext.opportunity.tam_estimate}
              {" · "}URG {pageContext.opportunity.urgency_score}/10
            </p>
          </div>
        )}

        {pageContext?.type === "explore" && pageContext.query && (
          <div className="border-b border-border bg-secondary/40 px-4 py-2.5">
            <p className="truncate text-xs font-medium text-foreground">{pageContext.query}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {pageContext.mode === "research" ? "web research" : "saved search"}
            </p>
          </div>
        )}

        <ResearchContext pageContext={pageContext} />

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

          {messages.map((m) => {
            const text = textFromMessage(m);
            return (
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
                  {text || (
                    <span className="flex gap-1 py-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
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
