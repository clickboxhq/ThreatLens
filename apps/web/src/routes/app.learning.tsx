import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useLearningOverview } from "@/hooks/use-learning-center";
import { useCertificates } from "@/hooks/use-certificates";
import { useLearningRecommendation } from "@/hooks/use-learning-recommendation";
import { ArrowUpRight, Award, GraduationCap, Target } from "lucide-react";

export const Route = createFileRoute("/app/learning")({
  component: LearningPage,
  head: () => ({ meta: [{ title: "ThreatLens · Learning Center" }] }),
});

function LearningPage() {
  const { isPending, tracks } = useLearningOverview();
  const { certificates } = useCertificates();
  const { recommendation } = useLearningRecommendation();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Learning Center"
        description="Structured career paths and mastery-based certification, tracked from your real scores."
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

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState
          title="No learning tracks yet"
          description="Career tracks will appear here once they're published."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tracks.map((t) => (
            <Panel key={t.id}>
              <div className="flex items-center gap-2 text-[color:var(--info)]">
                <GraduationCap className="size-4" />
                <span className="text-[11px] uppercase tracking-wider">Career Track</span>
              </div>
              <h3 className="mt-2 text-[15px] font-semibold">{t.name}</h3>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {t.pathCount} {t.pathCount === 1 ? "path" : "paths"} · {t.scenarioCount} scenarios
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
              <Link
                to="/app/scenarios"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-[12px] text-secondary hover:text-foreground"
              >
                Continue
              </Link>
            </Panel>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Panel title="Certificates" padded={false}>
          {certificates.length === 0 ? (
            <div className="px-4 py-6">
              <p className="text-[12px] text-secondary">
                Complete every scenario in a career track to earn one.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {certificates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Award className="size-4 text-[color:var(--info)]" />
                  <div className="flex-1 text-[13px] font-medium">{c.learningPathTitle}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(c.issuedAt).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
