import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { useScenarios } from "@/hooks/use-scenarios";
import { Clock, Filter, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/app/scenarios")({
  component: ScenarioLib,
  head: () => ({ meta: [{ title: "ThreatLens · Scenario Library" }] }),
});

function ScenarioLib() {
  const { scenarios } = useScenarios();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Scenario Library"
        description="Enterprise-grade attack simulations across identity, endpoint, cloud, and email."
        actions={
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary">
            <Filter className="size-3.5" /> Filters
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => (
          <Panel key={s.id}>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-mono">{s.id}</span>
              <span className="rounded border border-border bg-background px-1.5 py-0.5">
                {s.category}
              </span>
            </div>
            <h3 className="mt-2 text-[14.5px] font-medium leading-snug">{s.title}</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.mitre.map((m) => (
                <span
                  key={m}
                  className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-secondary"
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-muted-foreground">Difficulty</div>
                <div className="mt-0.5 font-medium">{s.difficulty}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="mt-0.5 flex items-center gap-1 font-medium">
                  <Clock className="size-3" /> {s.duration}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Completion</div>
                <div className="mt-0.5 font-medium tabular-nums">{s.completion}%</div>
              </div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-[color:var(--info)]"
                style={{ width: `${s.completion}%` }}
              />
            </div>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
              <PlayCircle className="size-4" /> Launch investigation
            </button>
          </Panel>
        ))}
      </div>
    </div>
  );
}
