import { Link } from "@tanstack/react-router";
import type { Opportunity } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";
import { UrgencyMeter } from "./UrgencyMeter";

export function OpportunityCard({ o }: { o: Opportunity }) {
  return (
    <div
      className={`glow-hover relative flex flex-col rounded-xl border border-border bg-card p-5 ${
        o.is_hot ? "hot-border" : ""
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {o.sources.map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
        </div>
        {o.is_hot && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            ● Hot
          </span>
        )}
      </div>
      <h3 className="text-base font-semibold leading-snug text-foreground">
        {o.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {o.pain_summary}
      </p>
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
