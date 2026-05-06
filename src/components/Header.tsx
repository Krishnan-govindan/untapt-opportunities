import { Link, useLocation } from "@tanstack/react-router";

export function Header() {
  const location = useLocation();

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
        </nav>
      </div>
    </header>
  );
}
