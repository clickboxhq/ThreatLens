import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useAchievements } from "@/hooks/use-achievements";
import type { AchievementKey } from "@/types/socverse-achievements";
import { Award, Crosshair, Flame, Radar, ShieldCheck, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/app/achievements")({
  component: Achievements,
  head: () => ({
    meta: [
      { title: "ThreatLens · Achievements" },
      {
        name: "description",
        content: "Investigation milestones earned across ThreatLens scenarios.",
      },
      { property: "og:title", content: "ThreatLens · Achievements" },
      {
        property: "og:description",
        content: "Milestones for accuracy, evidence quality, and ATT&CK breadth.",
      },
    ],
  }),
});

const ICONS: Record<AchievementKey, LucideIcon> = {
  first_blood: Flame,
  perfect_score: Award,
  sharpshooter: Crosshair,
  technique_master: Target,
  verdict_veteran: ShieldCheck,
  no_hints_needed: Radar,
  category_explorer: Radar,
};

function Achievements() {
  const { achievements, state } = useAchievements();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Achievements"
        description="Milestones awarded for investigation accuracy, evidence quality, and ATT&CK breadth."
      />
      {state === "loading" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : state === "error" ? (
        <EmptyState title="Couldn't load your achievements" description="Try reloading the page." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.map((a) => {
            const Icon = ICONS[a.key];
            const got = a.earnedAt !== null;
            return (
              <Panel key={a.key}>
                <div className="flex items-start gap-3">
                  <IconTile tone={got ? "success" : "neutral"} size="lg">
                    <Icon className="size-5" />
                  </IconTile>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{a.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {a.description}
                    </div>
                    <div
                      className="mt-2 text-[10.5px] uppercase tracking-wider"
                      style={{ color: got ? "var(--success)" : "var(--muted-foreground)" }}
                    >
                      {got ? `Earned ${new Date(a.earnedAt!).toLocaleDateString()}` : "Locked"}
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
