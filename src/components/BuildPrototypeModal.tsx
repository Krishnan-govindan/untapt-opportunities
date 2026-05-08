import { useRef, useState } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { GuestEmailDialog } from "@/components/GuestEmailDialog";

// ── types ────────────────────────────────────────────────────────────────────

type StepId = "researching" | "strategizing" | "branding" | "designing" | "deploying";

const STEPS: { id: StepId; label: string; icon: string }[] = [
  { id: "researching", label: "Researching opportunity", icon: "🔍" },
  { id: "strategizing", label: "Assembling business plan", icon: "🎯" },
  { id: "branding", label: "Generating brand identity", icon: "✦" },
  { id: "designing", label: "Assembling landing page", icon: "⚡" },
  { id: "deploying", label: "Deploying to Vercel", icon: "🚀" },
];

const STEP_ORDER: StepId[] = ["researching", "strategizing", "branding", "designing", "deploying"];

type Phase =
  | { kind: "idle" }
  | { kind: "running"; step: StepId; message: string }
  | { kind: "done"; demoPath: string; startupName: string }
  | { kind: "error"; message: string };

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── component ────────────────────────────────────────────────────────────────

export function BuildPrototypeModal({
  opportunity,
  sourceType = "opportunity",
  open,
  onClose,
}: {
  opportunity: Opportunity;
  sourceType?: "opportunity" | "idea";
  open: boolean;
  onClose: () => void;
}) {
  const { session, user, isGuest, guestId, guestEmail, setGuestEmail, continueAsGuest } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const handleClose = () => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setTimeout(() => setPhase({ kind: "idle" }), 300);
    onClose();
  };

  const startBuild = async (emailOverride?: string, guestIdOverride?: string | null) => {
    setPhase({ kind: "running", step: "researching", message: "Starting build…" });

    try {
      const email = emailOverride ?? user?.email ?? guestEmail ?? "";
      const activeGuestId =
        guestIdOverride ?? guestId ?? (!session?.access_token ? continueAsGuest() : null);
      if (!session?.access_token && (!isGuest || !activeGuestId) && !guestIdOverride) {
        setPhase({ kind: "idle" });
        setEmailDialogOpen(true);
        return;
      }

      const res = await fetch("/api/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          source_type: sourceType,
          opportunity_id: sourceType === "opportunity" ? opportunity.id : undefined,
          source_idea_id: sourceType === "idea" ? opportunity.id : undefined,
          email,
          guest_id: session?.access_token ? undefined : activeGuestId,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setPhase({ kind: "error", message: data?.error ?? "Prototype build failed." });
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
          break;
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
                  demoPath: typeof data.url === "string" ? data.url : `/demo/${opportunity.id}`,
                  startupName: data.startup_name as string,
                });
              } else if (currentEvent === "error") {
                setPhase({ kind: "error", message: data.message as string });
              }
            } catch {
              /* malformed line */
            }
            currentEvent = "";
          }
        }
      }
    } catch {
      setPhase({ kind: "error", message: "Prototype build failed — check your connection." });
    } finally {
      readerRef.current = null;
    }
  };

  const handleSubmit = async () => {
    await startBuild();
  };

  const openDemo = (path: string) => {
    window.open(path, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Build this business</DialogTitle>
          <DialogDescription className="line-clamp-2">{opportunity.title}</DialogDescription>
        </DialogHeader>

        {/* ── Idle ─── */}
        {phase.kind === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We'll assemble a logo, landing page, and business plan from the cached template — then
              deploy it live.
            </p>
            <button
              onClick={handleSubmit}
              autoFocus
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
            >
              Build this business →
            </button>
          </div>
        )}

        {/* ── Running ─── */}
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
                    state === "pending" && "border-border opacity-25",
                  )}
                >
                  <span className="text-base leading-none">{step.icon}</span>
                  <span className="flex-1 text-sm">{step.label}</span>
                  {state === "active" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {state === "complete" && <CheckCircle className="h-4 w-4 text-primary" />}
                </div>
              );
            })}
            <p className="pt-1 text-center text-[11px] italic text-muted-foreground">
              {phase.message}
            </p>
          </div>
        )}

        {/* ── Done ─── */}
        {phase.kind === "done" && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Your prototype is live</h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{phase.startupName}</p>
            </div>
            <button
              onClick={() => openDemo(phase.demoPath)}
              className="block w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
            >
              View your prototype →
            </button>
            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to opportunity
            </button>
          </div>
        )}

        {/* ── Error ─── */}
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
      <GuestEmailDialog
        open={emailDialogOpen}
        initialEmail={guestEmail}
        title="Where should we send this prototype?"
        description="Enter an email so this guest prototype can be linked back to you."
        skipLabel="Skip and build"
        onOpenChange={setEmailDialogOpen}
        onSkip={() => {
          const nextGuestId = continueAsGuest();
          void startBuild(undefined, nextGuestId);
        }}
        onSubmit={(email) => {
          const nextGuestId = setGuestEmail(email);
          void startBuild(email, nextGuestId);
        }}
      />
    </Dialog>
  );
}
