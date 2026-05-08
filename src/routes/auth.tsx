import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { continueAsGuest } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSuccess = () => {
    navigate({ to: redirect ?? "/" });
  };

  const handleGuestContinue = () => {
    continueAsGuest();
    handleSuccess();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        });
        if (error) {
          toast.error(error.message);
        } else {
          setForgotSent(true);
        }
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Check your email to confirm your account.");
          handleSuccess();
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        handleSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, string> = {
    login: "Sign in to untapt",
    signup: "Create your account",
    forgot: "Reset your password",
  };

  return (
    <main className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow" />
          <h1 className="font-mono text-sm font-semibold tracking-tight text-foreground">
            untapt
          </h1>
        </div>

        <h2 className="mb-6 text-center text-lg font-semibold text-foreground">
          {titles[mode]}
        </h2>

        {/* Forgot password success */}
        {mode === "forgot" && forgotSent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              We sent a reset link to <strong className="text-foreground">{email}</strong>. Check
              your inbox.
            </p>
            <button
              onClick={() => { setMode("login"); setForgotSent(false); }}
              className="text-xs text-primary underline hover:opacity-80"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* Guest mode — not shown on forgot screen */}
            {mode !== "forgot" && (
              <>
                <button
                  onClick={handleGuestContinue}
                  className="flex w-full items-center justify-center rounded-xl border border-orange-500/40 bg-orange-500/10 py-2.5 text-sm font-medium text-orange-300 hover:bg-orange-500/15 transition-colors"
                >
                  Continue without sign-in
                </button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
                  </div>
                </div>
              </>
            )}

            {/* Email / password form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {mode !== "forgot" && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
              </button>
            </form>

            {/* Footer links */}
            <div className="mt-5 space-y-2 text-center text-xs text-muted-foreground">
              {mode === "login" && (
                <>
                  <p>
                    <button
                      onClick={() => setMode("forgot")}
                      className="text-primary underline hover:opacity-80"
                    >
                      Forgot password?
                    </button>
                  </p>
                  <p>
                    Don't have an account?{" "}
                    <button
                      onClick={() => setMode("signup")}
                      className="text-primary underline hover:opacity-80"
                    >
                      Sign up
                    </button>
                  </p>
                </>
              )}
              {mode === "signup" && (
                <p>
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="text-primary underline hover:opacity-80"
                  >
                    Sign in
                  </button>
                </p>
              )}
              {mode === "forgot" && (
                <p>
                  <button
                    onClick={() => setMode("login")}
                    className="text-primary underline hover:opacity-80"
                  >
                    Back to sign in
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
