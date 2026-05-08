import { Link, useLocation } from "@tanstack/react-router";
import { useAgent } from "@/lib/agent-context";

export function Header() {
  const location = useLocation();
  const { toggle, isOpen } = useAgent();

  const linkCls = (active: boolean) =>
    `whitespace-nowrap text-xs transition-colors sm:text-sm ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:h-14 sm:px-6 sm:py-0">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="h-5 w-5 shrink-0 rounded-sm bg-gradient-to-br from-primary to-primary-glow" />
          <span className="hidden font-mono text-sm font-semibold tracking-tight sm:inline">
            untapt
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:flex-none sm:gap-6">
          <Link to="/" className={linkCls(location.pathname === "/")}>
            Feed
          </Link>
          <Link to="/explore" className={linkCls(location.pathname === "/explore")}>
            Explore
          </Link>
          <Link to="/studio" className={linkCls(location.pathname === "/studio")}>
            Studio
          </Link>
          <Link to="/my-businesses" className={linkCls(location.pathname === "/my-businesses")}>
            My Businesses
          </Link>

          <button
            onClick={toggle}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all sm:px-3 ${
              isOpen
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            title="Toggle AI agent (⌘K)"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isOpen ? "text-primary" : ""}
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
            </svg>
            <span>Agent</span>
            <kbd className="hidden rounded border border-border bg-muted px-1 font-mono text-[9px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </button>
        </nav>
      </div>
    </header>
  );
}
