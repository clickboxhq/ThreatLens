import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useAchievements } from "@/hooks/use-achievements";

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

function Achievements() {
  const { achievements: badges } = useAchievements();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Achievements"
        description="Milestones awarded for investigation accuracy, evidence quality, and ATT&CK breadth."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {badges.map((b) => {
          const Icon = b.icon;
          return (
            <Panel key={b.name}>
              <div className="flex items-start gap-3">
                <IconTile tone={b.got ? "success" : "neutral"} size="lg">
                  <Icon className="size-5" />
                </IconTile>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{b.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{b.detail}</div>
                  <div
                    className="mt-2 text-[10.5px] uppercase tracking-wider"
                    style={{ color: b.got ? "var(--success)" : "var(--muted-foreground)" }}
                  >
                    {b.got ? "Earned" : "Locked"}
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
