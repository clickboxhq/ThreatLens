import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function Trend({ delta, suffix = "%" }: { delta: number; suffix?: string }) {
  const up = delta > 0;
  const flat = delta === 0;
  const cls = flat
    ? "text-muted-foreground"
    : up
      ? "text-[color:var(--info)]"
      : "text-[color:var(--critical)]";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${cls}`}
    >
      <Icon className="size-3" />
      {Math.abs(delta)}
      {suffix}
    </span>
  );
}
