export function UrgencyMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-muted-foreground">URG</span>
      <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary-glow"
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-foreground">{score}</span>
    </div>
  );
}
