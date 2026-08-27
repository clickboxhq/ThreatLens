import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { useScenarioBuilder } from "@/hooks/use-scenario-builder";
import { Plus, Save } from "lucide-react";

export const Route = createFileRoute("/app/scenario-builder")({
  component: ScenarioBuilder,
  head: () => ({
    meta: [
      { title: "ThreatLens · Scenario Builder" },
      {
        name: "description",
        content:
          "Author synthetic telemetry, ground truth, and automated grading for SOC investigation scenarios.",
      },
      { property: "og:title", content: "ThreatLens · Scenario Builder" },
      {
        property: "og:description",
        content: "Instructor authoring for identity, endpoint, email, cloud, and network events.",
      },
    ],
  }),
});

function ScenarioBuilder() {
  const {
    eventSources,
    draftTimeline: timeline,
    config,
    validationMessages,
  } = useScenarioBuilder();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Scenario Builder"
        description="Instructor authoring — compose synthetic telemetry, hide the ground truth, and configure automated grading."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary hover:text-foreground">
              <Plus className="size-3.5" /> Add event
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
              <Save className="size-3.5" /> Publish scenario
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Panel title="Event sources" padded={false}>
          <div className="divide-y divide-border">
            {eventSources.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-background/40"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-[12.5px]">{s.label}</span>
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10.5px] tabular-nums text-secondary">
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Injected timeline — SC-082 Draft" padded={false}>
          <div className="divide-y divide-border">
            {timeline.map((e) => (
              <div
                key={e.t}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-background/40"
              >
                <span className="font-mono text-[11px] text-muted-foreground">{e.t}</span>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px]">{e.detail}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {e.src} · <span className="font-mono">{e.mitre}</span>
                  </div>
                </div>
                <SeverityBadge level={e.sev} />
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Configuration">
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="text-muted-foreground">Difficulty</div>
                <div className="mt-1 flex gap-1">
                  {["Beginner", "Intermediate", "Advanced", "Expert"].map((d, i) => (
                    <span
                      key={d}
                      className={`rounded border px-1.5 py-0.5 text-[10.5px] ${i === 2 ? "border-[color:var(--info)]/40 bg-[color:var(--info)]/10 text-[color:var(--info)]" : "border-border bg-background text-muted-foreground"}`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              {config.map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between border-t border-border pt-2"
                >
                  <span className="text-muted-foreground">{r.k}</span>
                  <span className="text-right text-secondary">{r.v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Validation">
            <ul className="space-y-2 text-[12px] text-secondary">
              {validationMessages.map((m, i) => (
                <li
                  key={m}
                  className={
                    i === validationMessages.length - 1 ? "text-[color:var(--warning)]" : undefined
                  }
                >
                  {m}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
