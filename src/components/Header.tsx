import { Link, useLocation } from "@tanstack/react-router";
import { useAgent } from "@/lib/agent-context";

export function Header() {
  const location = useLocation();
  const { toggle, isOpen } = useAgent();

  const linkCls = (active: boolean) =>
    `text-sm transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-sm bg-gradient-to-br from-primary to-primary-glow" />
          <span className="font-mono text-sm font-semibold tracking-tight">untapt</span>
        </Link>

        <nav className="flex items-center gap-6">
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
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
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
