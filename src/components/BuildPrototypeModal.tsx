import { useRef, useState } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { Opportunity } from "@/lib/types";

// ── Demo simulation ────────────────────────────────────────────────────────────
// When running on localhost the API routes aren't served by the Vite dev server
// (they need the full Cloudflare Workers runtime). We simulate the pipeline so
// the full UX flow is demonstrable without any backend.
const IS_LOCAL = typeof window !== "undefined" && window.location.hostname === "localhost";

function toSlug(title: string) {
  const full = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (full.length <= 28) return full.replace(/-+$/, "");
  const cut = full.slice(0, 29);
  const lastDash = cut.lastIndexOf("-");
  return lastDash > 0 ? cut.slice(0, lastDash) : cut.slice(0, 28);
}

function toStartupName(title: string): string {
  return title.split(/\s+/).slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

type SimEvent = { event: "status"; step: StepId; message: string } | { event: "done"; url: string; startupName: string };

async function* simulatePipeline(opportunity: Opportunity): AsyncGenerator<SimEvent> {
  const slug = toSlug(opportunity.title);
  const startupName = toStartupName(opportunity.title);
  const demoUrl = `https://pain-${slug}-demo.vercel.app`;

  const steps: [StepId, string, number][] = [
    ["researching",  "Setting up build job…",                  800],
    ["researching",  "Fetching opportunity data…",             1200],
    ["strategizing", "Crafting your business strategy…",       3500],
    ["branding",     "Generating your brand identity…",        1500],
    ["designing",    "Claude is writing your landing page…",   6000],
    ["deploying",    "Uploading files to Vercel…",             2000],
    ["deploying",    "Waiting for deployment to go live…",     4500],
    ["deploying",    "Sending your business plan…",             800],
  ];

  for (const [step, message, delay] of steps) {
    yield { event: "status", step, message };
    await new Promise((r) => setTimeout(r, delay));
  }

  yield { event: "done", url: demoUrl, startupName };
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StepId = "researching" | "strategizing" | "branding" | "designing" | "deploying";

const STEPS: { id: StepId; label: string; icon: string }[] = [
  { id: "researching",  label: "Researching opportunity",    icon: "🔍" },
  { id: "strategizing", label: "Crafting business strategy",  icon: "🎯" },
  { id: "branding",     label: "Generating brand identity",   icon: "✦"  },
  { id: "designing",    label: "Writing landing page",        icon: "⚡" },
  { id: "deploying",    label: "Deploying to Vercel",         icon: "🚀" },
];

const STEP_ORDER: StepId[] = ["researching", "strategizing", "branding", "designing", "deploying"];

type Phase =
  | { kind: "idle" }
  | { kind: "running"; step: StepId; message: string }
  | { kind: "done"; url: string; startupName: string }
  | { kind: "error"; message: string };

function getStepState(stepId: StepId, phase: Phase): "pending" | "active" | "complete" {
  if (phase.kind === "idle") return "pending";
  if (phase.kind === "done") return "complete";
  if (phase.kind === "error") return "complete";
  const currentIdx = STEP_ORDER.indexOf(phase.step);
  const stepIdx = STEP_ORDER.indexOf(stepId);
  if (stepIdx < currentIdx) return "complete";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function BuildPrototypeModal({
  opportunity,
  open,
  onClose,
}: {
  opportunity: Opportunity;
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const handleClose = () => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setTimeout(() => setPhase({ kind: "idle" }), 300);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setPhase({ kind: "running", step: "researching", message: "Starting build…" });

    // ── Demo mode (localhost): simulate the pipeline without real API calls ──
    if (IS_LOCAL) {
      try {
        for await (const evt of simulatePipeline(opportunity)) {
          if (evt.event === "status") {
            setPhase({ kind: "running", step: evt.step, message: evt.message });
          } else {
            setPhase({ kind: "done", url: evt.url, startupName: evt.startupName });
          }
        }
      } catch (err) {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
      return;
    }

    // ── Production: stream real SSE from /api/build ──────────────────────────
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: opportunity.id, email: trimmed }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        let errMsg = errText;
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          errMsg = parsed.error ?? errText;
        } catch {}
        setPhase({ kind: "error", message: errMsg });
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const dec = new TextDecoder();
      let buf = "";
      let currentEvent = "";

      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch {
          break; // reader cancelled (user closed modal)
        }
        const { done, value } = result;
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
              if (currentEvent === "status") {
                setPhase({
                  kind: "running",
                  step: data.step as StepId,
                  message: data.message as string,
                });
              } else if (currentEvent === "done") {
                setPhase({
                  kind: "done",
                  url: data.url as string,
                  startupName: data.startup_name as string,
                });
              } else if (currentEvent === "error") {
                setPhase({ kind: "error", message: data.message as string });
              }
            } catch {
              // malformed JSON line — skip
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      readerRef.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Build this prototype</DialogTitle>
          <DialogDescription className="line-clamp-2">{opportunity.title}</DialogDescription>
        </DialogHeader>

        {/* ── Idle: email form ───────────────────────────────────────── */}
        {phase.kind === "idle" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Where should we send the link?
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="you@example.com"
                autoFocus
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>
            <button
              onClick={handleSubmit}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
            >
              Build this prototype →
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              We'll generate a logo, landing page, and business plan — then deploy it live.
            </p>
          </div>
        )}

        {/* ── Running: step cards ────────────────────────────────────── */}
        {phase.kind === "running" && (
          <div className="space-y-2.5">
            {STEPS.map((step) => {
              const state = getStepState(step.id, phase);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-all duration-500",
                    state === "active" && "border-primary/50 bg-primary/5",
                    state === "complete" && "border-border opacity-60",
                    state === "pending" && "border-border opacity-25"
                  )}
                >
                  <span className="text-base leading-none">{step.icon}</span>
                  <span className="flex-1 text-sm">{step.label}</span>
                  {state === "active" && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {state === "complete" && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
              );
            })}
            <p className="pt-1 text-center text-[11px] italic text-muted-foreground">
              {phase.message}
            </p>
          </div>
        )}

        {/* ── Done: success ──────────────────────────────────────────── */}
        {phase.kind === "done" && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Your prototype is live</h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {phase.startupName}
              </p>
            </div>
            <a
              href={phase.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
            >
              View your prototype →
            </a>
            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to opportunity
            </button>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {phase.kind === "error" && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-destructive">{phase.message}</p>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="rounded-xl border border-border bg-secondary px-5 py-2 text-sm hover:bg-secondary/80 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
