import { Link } from "@tanstack/react-router";
import type { Opportunity } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";
import { UrgencyMeter } from "./UrgencyMeter";

function categoryBadges(o: Opportunity) {
  const badges: { emoji: string; label: string; cls: string }[] = [];
  if (o.is_hot) badges.push({ emoji: "🔥", label: "Hot", cls: "badge-hot" });
  if (!o.is_hot && o.urgency_score >= 8)
    badges.push({ emoji: "⚡", label: "Urgent", cls: "badge-urgent" });
  if (o.urgency_score <= 3)
    badges.push({ emoji: "🧊", label: "Early", cls: "badge-early" });
  const tam = o.tam_estimate ?? "";
  if (/\$\d.*[BT]/.test(tam) || /billion|trillion/i.test(tam))
    badges.push({ emoji: "💰", label: "Big TAM", cls: "badge-tam" });
  if ((o.sources?.length ?? 0) >= 3)
    badges.push({ emoji: "📡", label: "Multi-signal", cls: "badge-multi" });
  return badges;
}

const PLATFORM_TO_SOURCE: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "HN",
  twitter: "X",
  google: "Product Hunt",
};

const FALLBACK_URLS: Record<string, (slug: string) => string> = {
  Reddit: (slug) => `https://reddit.com/r/entrepreneur/search/?q=${slug}`,
  X: (slug) => `https://x.com/search?q=${slug}`,
  HN: (_slug) => `https://news.ycombinator.com/ask`,
  "Product Hunt": (slug) => `https://producthunt.com/search?q=${slug}`,
};

function titleSlug(title: string): string {
  return encodeURIComponent(title.toLowerCase().replace(/\s+/g, "+").slice(0, 40));
}

function sourceUrlFor(o: Opportunity, source: string): string | undefined {
  // source may be a platform key ("reddit") or a display name ("Reddit")
  const platform = PLATFORM_TO_SOURCE[source] ? source : Object.entries(PLATFORM_TO_SOURCE).find(([, v]) => v === source)?.[0];
  const displayName = PLATFORM_TO_SOURCE[source] ?? source;
  if (o.sources_detail?.length) {
    return o.sources_detail.find((s) => s.platform === platform)?.url;
  }
  return FALLBACK_URLS[displayName]?.(titleSlug(o.title));
}

function shortDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const path = new URL(url).pathname.slice(0, 28);
    return (host + path).slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}

export function OpportunityCard({ o }: { o: Opportunity }) {
  // Guard against rows where `sources` accidentally stored full URLs instead of platform names
  const validSources = (o.sources ?? []).filter((s) => !s.startsWith("http"));

  const realLinks = o.sources_detail?.filter((s) => s.url) ?? [];
  // Fall back to one demo link per platform badge when no real sources exist
  const sourceLinks = realLinks.length > 0
    ? realLinks
    : validSources.slice(0, 2).map((s) => ({
        url: FALLBACK_URLS[PLATFORM_TO_SOURCE[s] ?? s]?.(titleSlug(o.title)) ?? "",
        platform: s,
        snippet: "",
      })).filter((s) => s.url);

  const badges = categoryBadges({ ...o, sources: validSources });

  return (
    <div
      className={`glow-hover relative flex flex-col rounded-xl border border-border bg-card p-5 ${
        o.is_hot ? "hot-border" : ""
      }`}
    >
      {/* Category badges row */}
      {badges.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span key={b.label} className={`category-badge ${b.cls}`}>
              {b.emoji} {b.label}
            </span>
          ))}
        </div>
      )}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {validSources.map((s) => (
            <SourceBadge key={s} source={s} href={sourceUrlFor(o, s)} />
          ))}
        </div>
      </div>
      <h3 className="text-base font-semibold leading-snug text-foreground">
        {o.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {o.pain_summary}
      </p>
      {sourceLinks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {sourceLinks.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-muted-foreground hover:text-primary truncate max-w-[180px]"
            >
              ↗ {shortDomain(s.url)}
            </a>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-foreground">{o.tam_estimate}</span>
          <span className="text-muted-foreground">·</span>
          <UrgencyMeter score={o.urgency_score} />
        </div>
        <Link
          to="/opportunity/$id"
          params={{ id: o.id }}
          className="rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary"
        >
          View
        </Link>
      </div>
    </div>
  );
}
