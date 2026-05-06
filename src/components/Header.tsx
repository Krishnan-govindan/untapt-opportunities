import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const location = useLocation();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const linkCls = (active: boolean) =>
    `text-sm transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-sm bg-gradient-to-br from-primary to-primary-glow" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            untapt
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/" className={linkCls(location.pathname === "/")}>
            Feed
          </Link>
          <Link to="/built" className={linkCls(location.pathname === "/built")}>
            Built
          </Link>
          {session ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
