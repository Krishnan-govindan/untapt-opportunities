import { useState } from "react";
import type { Opportunity } from "@/lib/types";
import { toast } from "sonner";

type Step = "idle" | "researching" | "designing" | "deploying" | "deployed" | "failed";

const STEPS: { key: Step; label: string }[] = [
  { key: "researching", label: "Researching opportunity" },
  { key: "designing", label: "Claude designing landing page" },
  { key: "deploying", label: "Deploying to Vercel" },
];

const ACTIVE_STEPS: Step[] = ["researching", "designing", "deploying"];

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
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");

  if (!open) return null;

  const reset = () => {
    setStep("idle");
    setMessage("");
    setUrl("");
  };

  const start = async () => {
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }

    setStep("researching");
    setMessage("Starting…");

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: opportunity.id, email }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error (${res.status})`);
      }

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

              if (currentEvent === "status") {
                setStep(data.step as Step);
                setMessage(data.message as string);
              } else if (currentEvent === "done") {
                setStep("deployed");
                setUrl(data.url as string);
                toast.success("Prototype is live!");
              } else if (currentEvent === "error") {
                throw new Error(data.message as string);
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                // malformed SSE data line — skip
              } else {
                throw parseErr;
              }
            }
            currentEvent = "";
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Build failed";
      setStep("failed");
      setMessage(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Build this prototype</h3>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {opportunity.title.slice(0, 48)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Idle ── */}
        {step === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Claude generates a full landing page and deploys it to Vercel in ~60 seconds.
              We'll email you the live URL.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="you@company.com"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={start}
              className="w-full rounded-md bg-gradient-to-r from-primary to-primary-glow px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              Generate prototype →
            </button>
          </div>
        )}

        {/* ── In progress ── */}
        {ACTIVE_STEPS.includes(step) && (
          <div className="space-y-5">
            <ul className="space-y-3">
              {STEPS.map((s) => {
                const myIdx = ACTIVE_STEPS.indexOf(s.key);
                const curIdx = ACTIVE_STEPS.indexOf(step);
                const state =
                  myIdx < curIdx ? "done" : myIdx === curIdx ? "active" : "pending";
                return (
                  <li key={s.key} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                        state === "done"
                          ? "bg-primary text-primary-foreground"
                          : state === "active"
                            ? "animate-pulse border border-primary text-primary"
                            : "border border-border text-muted-foreground"
                      }`}
                    >
                      {state === "done" ? "✓" : myIdx + 1}
                    </span>
                    <span
                      className={
                        state === "pending" ? "text-muted-foreground" : "text-foreground"
                      }
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            {message && (
              <p className="font-mono text-[11px] text-muted-foreground">{message}</p>
            )}

            <div className="h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-700"
                style={{
                  width:
                    step === "researching" ? "15%" : step === "designing" ? "50%" : "85%",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Deployed ── */}
        {step === "deployed" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Live URL
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all font-mono text-sm text-primary hover:underline"
              >
                {url}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-mono text-foreground">{email}</span>.
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              Built in 47 seconds by Untapt.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:border-primary/50"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Failed ── */}
        {step === "failed" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
              <p className="text-sm text-red-400">
                {message || "Build failed — please try again."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-primary/50"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-md bg-secondary px-4 py-2 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
