import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSuccess = () => {
    navigate({ to: redirect ?? "/" });
  };

  const handleGoogleSignIn = async () => {
    const callbackUrl =
      typeof window !== "undefined"
        ? new URL("/auth/callback", window.location.origin)
        : undefined;
    if (callbackUrl && redirect) callbackUrl.searchParams.set("redirect", redirect);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl?.toString(),
      },
    });
    if (error) toast.error(error.message);
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
            {/* Google OAuth — not shown on forgot screen */}
            {mode !== "forgot" && (
              <>
                <button
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
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
