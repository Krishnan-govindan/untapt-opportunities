import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/lib/types";
import { toast } from "sonner";

type Status = "idle" | "researching" | "designing" | "deploying" | "deployed";

const STEPS: { key: Status; label: string }[] = [
  { key: "researching", label: "Researching market and competitors" },
  { key: "designing", label: "Designing UI and component tree" },
  { key: "deploying", label: "Deploying to Vercel" },
];

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
  const [status, setStatus] = useState<Status>("idle");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      if (data.session?.user.email) setEmail(data.session.user.email);
    });
  }, [open]);

  if (!open) return null;

  const start = async () => {
    if (!userId) {
      toast.error("Sign in to build prototypes");
      return;
    }
    if (!email) {
      toast.error("Enter your email");
      return;
    }

    const slug = opportunity.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32);
    const url = `https://${slug}-${Math.random().toString(36).slice(2, 7)}.vercel.app`;

    const { data: row, error } = await supabase
      .from("prototypes")
      .insert({
        user_id: userId,
        opportunity_id: opportunity.id,
        name: opportunity.title,
        email,
        status: "researching",
      })
      .select()
      .single();

    if (error || !row) {
      toast.error("Couldn't start build");
      return;
    }

    for (const step of STEPS) {
      setStatus(step.key);
      await supabase.from("prototypes").update({ status: step.key }).eq("id", row.id);
      await new Promise((r) => setTimeout(r, 2200));
    }

    await supabase
      .from("prototypes")
      .update({ status: "deployed", deployed_url: url })
      .eq("id", row.id);
    setDeployedUrl(url);
    setStatus("deployed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Build this prototype</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {status === "idle" && (
          <>
            <p className="text-sm text-muted-foreground">
              We'll generate a working prototype, deploy it to Vercel, and email you the URL.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-4 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={start}
              className="mt-3 w-full rounded-md bg-gradient-to-r from-primary to-primary-glow px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              Generate
            </button>
          </>
        )}

        {status !== "idle" && status !== "deployed" && (
          <ul className="mt-2 space-y-3">
            {STEPS.map((s) => {
              const idx = STEPS.findIndex((x) => x.key === status);
              const myIdx = STEPS.findIndex((x) => x.key === s.key);
              const state = myIdx < idx ? "done" : myIdx === idx ? "active" : "pending";
              return (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ${
                      state === "done"
                        ? "bg-primary text-primary-foreground"
                        : state === "active"
                          ? "border border-primary text-primary"
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
                    {state === "active" && (
                      <span className="ml-1 inline-flex">
                        <span className="animate-pulse">.</span>
                        <span className="animate-pulse [animation-delay:150ms]">.</span>
                        <span className="animate-pulse [animation-delay:300ms]">.</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {status === "deployed" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Deployed
              </p>
              <a
                href={deployedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all font-mono text-sm text-primary hover:underline"
              >
                {deployedUrl}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-mono text-foreground">{email}</span>.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:border-primary/50"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
