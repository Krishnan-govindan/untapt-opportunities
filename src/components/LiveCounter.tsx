import { useEffect, useRef, useState } from "react";

export function LiveCounter({ value }: { value: number }) {
  const [tick, setTick] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      setTick((t) => t + 1);
      prev.current = value;
    }
  }, [value]);

  const display = value.toLocaleString();
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card/60 px-4 py-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span
        key={tick}
        className="tick-anim font-mono text-base font-semibold tabular-nums text-foreground"
      >
        {display}
      </span>
      <span className="text-xs text-muted-foreground">opportunities found</span>
    </div>
  );
}
