import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton } from "@/components/soc/ui/skeleton";
import { useCareerProgression } from "@/hooks/use-career-progression";
import { Award, Check, Circle, Shield, ShieldCheck } from "lucide-react";
import type { CareerLevel } from "@/lib/auth-store";

export const Route = createFileRoute("/app/progress")({
  component: MyProgress,
  head: () => ({ meta: [{ title: "ThreatLens · My Progress" }] }),
});

const LEVEL_ICON: Record<CareerLevel, typeof Shield> = {
  l1: Shield,
  l2: Award,
  senior: ShieldCheck,
};

/**
 * SOC Career Progression, made visible. The promotion logic
 * (career-progression-definitions.ts) has run after every scored session since it shipped —
 * this is the first place a Student can actually see where they stand against it, rather than
 * only finding out via the notification when a promotion happens to land.
 */
function MyProgress() {
  const { data, isPending } = useCareerProgression();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="My Progress"
        description="Your SOC career level, and what moves you to the next one."
      />

      {isPending || !data ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = LEVEL_ICON[data.currentLevel];
                return (
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--info)]/10 text-[color:var(--info)]">
                    <Icon className="size-5" />
                  </div>
                );
              })()}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Current level
                </div>
                <div className="text-[16px] font-semibold">{data.currentTitle}</div>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-[12px] text-secondary">
              {data.sessionsScored} scored investigation{data.sessionsScored === 1 ? "" : "s"} on
              record — every promotion threshold is evaluated against your full history, not just
              your most recent case.
            </div>
          </Panel>

          <Panel title={data.nextLevel ? `Next: ${data.nextLevel.title}` : undefined}>
            {!data.nextLevel ? (
              <div className="flex items-center gap-2.5 text-[12.5px] text-secondary">
                <ShieldCheck className="size-4 shrink-0 text-[color:var(--success)]" />
                You've reached the top of the career ladder. Independent investigation mode is
                fully unlocked.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.nextLevel.requirements.map((req) => (
                  <li key={req.label} className="flex items-start gap-2.5 text-[12.5px]">
                    {req.met ? (
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
                        <Check className="size-2.5" />
                      </span>
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={req.met ? "text-secondary line-through" : ""}>
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
