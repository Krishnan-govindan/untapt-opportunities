import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAgent } from "@/lib/agent-context";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

export function Header() {
  const location = useLocation();
  const { toggle, isOpen } = useAgent();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const linkCls = (active: boolean) =>
    `text-sm transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    navigate({ to: "/" });
  };

  const initials = user?.email?.slice(0, 1).toUpperCase() ?? "?";

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
          <ClientOnly>
            {user && (
              <>
                <Link to="/explore" className={linkCls(location.pathname === "/explore")}>
                  Explore
                </Link>
                <Link to="/studio" className={linkCls(location.pathname === "/studio")}>
                  Studio
                </Link>
                <Link to="/my-businesses" className={linkCls(location.pathname === "/my-businesses")}>
                  My Businesses
                </Link>
              </>
            )}
          </ClientOnly>

          {/* Agent toggle button */}
          <button
            onClick={toggle}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              isOpen
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            title="Toggle AI agent (⌘K)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={isOpen ? "text-primary" : ""}
            >
              <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
            </svg>
            <span>Agent</span>
            <kbd className="hidden rounded border border-border bg-muted px-1 font-mono text-[9px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </button>

          {/* Auth area */}
          <ClientOnly>
            {loading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                  title={user.email ?? "Account"}
                >
                  {initials}
                </button>
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border border-border bg-card p-1 shadow-lg">
                      <div className="px-3 py-2 text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={handleSignOut}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                Sign in
              </Link>
            )}
          </ClientOnly>
        </nav>
      </div>
    </header>
  );
}
