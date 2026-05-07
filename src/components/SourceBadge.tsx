const NORMALIZE: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "HN",
  twitter: "X",
  google: "Product Hunt",
};

const STYLES: Record<string, { label: string; cls: string }> = {
  Reddit: { label: "Reddit", cls: "bg-[color:var(--reddit)]/15 text-[color:var(--reddit)] border-[color:var(--reddit)]/30" },
  HN: { label: "HN", cls: "bg-[color:var(--hn)]/15 text-[color:var(--hn)] border-[color:var(--hn)]/30" },
  X: { label: "X", cls: "bg-[color:var(--x)]/10 text-[color:var(--x)] border-[color:var(--x)]/25" },
  ProductHunt: { label: "PH", cls: "bg-[color:var(--ph)]/15 text-[color:var(--ph)] border-[color:var(--ph)]/30" },
};

export function SourceBadge({ source, href }: { source: string; href?: string }) {
  const normalized = NORMALIZE[source] ?? source;
  const key = normalized === "Product Hunt" ? "ProductHunt" : normalized;
  const style = STYLES[key] ?? { label: normalized, cls: "bg-muted text-muted-foreground border-border" };
  const cls = `inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${style.cls}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} hover:opacity-80 transition-opacity`}>
        {style.label}
      </a>
    );
  }
  return <span className={cls}>{style.label}</span>;
}
