import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useAchievements } from "@/hooks/use-achievements";
import type { AchievementKey } from "@/types/socverse-achievements";

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

// One illustrated emblem per achievement — real artwork, not a UI icon standing in for one.
// Each ships on a solid black backing; `mix-blend-mode: screen` in the badge below drops that
// black to nothing against the card's own dark background rather than showing as a mismatched
// square, so the hexagon reads as sitting directly on the card.
const BADGES: Record<AchievementKey, string> = {
  first_blood: "/badges/first-blood.jpg",
  perfect_score: "/badges/perfect-score.jpg",
  sharpshooter: "/badges/sharpshooter.jpg",
  technique_master: "/badges/technique-master.jpg",
  verdict_veteran: "/badges/verdict-veteran.jpg",
  no_hints_needed: "/badges/no-hints-needed.jpg",
  category_explorer: "/badges/category-explorer.jpg",
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
            const got = a.earnedAt !== null;
            return (
              <Panel key={a.key}>
                <div className="flex items-start gap-4">
                  <img
                    src={BADGES[a.key]}
                    alt=""
                    aria-hidden="true"
                    className="size-20 shrink-0 mix-blend-screen transition-[filter,opacity] duration-300"
                    style={
                      got
                        ? undefined
                        : { filter: "grayscale(0.9) brightness(0.5) contrast(0.9)", opacity: 0.7 }
                    }
                  />
                  <div className="min-w-0 pt-1">
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
