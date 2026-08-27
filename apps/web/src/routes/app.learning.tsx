import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useLearningCenter } from "@/hooks/use-learning-center";
import { useLearningRecommendation } from "@/hooks/use-learning-recommendation";
import { ArrowUpRight, Award, GraduationCap, Target, Trophy } from "lucide-react";

export const Route = createFileRoute("/app/learning")({
  component: LearningPage,
  head: () => ({ meta: [{ title: "ThreatLens · Learning Center" }] }),
});

function LearningPage() {
  const { tracks, achievements, certificates } = useLearningCenter();
  const { recommendation } = useLearningRecommendation();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Learning Center"
        description="Structured career paths, hands-on labs, and mastery-based certification."
      />

      {recommendation && (
        <Panel className="mb-6" title="Recommended for you">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <IconTile tone="warning" size="md">
                <Target className="size-4" />
              </IconTile>
              <div>
                <div className="text-[13px] font-medium">{recommendation.scenarioTitle}</div>
                <p className="mt-0.5 max-w-lg text-[11.5px] text-secondary">
                  {recommendation.reason}
                </p>
              </div>
            </div>
            <Link
              to="/app/scenarios"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Start scenario <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tracks.map((t) => (
          <Panel key={t.name}>
            <div className="flex items-center gap-2 text-[color:var(--info)]">
              <GraduationCap className="size-4" />
              <span className="text-[11px] uppercase tracking-wider">Career Track</span>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold">{t.name}</h3>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {t.modules} modules · {t.hours} hrs
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-secondary">Progress</span>
                <span className="tabular-nums text-secondary">{t.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-[color:var(--info)]"
                  style={{ width: `${t.progress}%` }}
                />
              </div>
            </div>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-[12px] text-secondary hover:text-foreground">
              Continue
            </button>
          </Panel>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Achievements" padded={false}>
          <ul className="divide-y divide-border">
            {achievements.map((a) => (
              <li key={a.title} className="flex items-center gap-3 px-4 py-3">
                <Trophy className="size-4 text-[color:var(--warning)]" />
                <div>
                  <div className="text-[13px] font-medium">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">{a.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent certificates" padded={false}>
          <ul className="divide-y divide-border">
            {certificates.map((c) => (
              <li key={c.name} className="flex items-center gap-3 px-4 py-3">
                <Award className="size-4 text-[color:var(--info)]" />
                <div className="flex-1 text-[13px] font-medium">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{c.date}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
