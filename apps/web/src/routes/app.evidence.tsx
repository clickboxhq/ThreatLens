import { createFileRoute, Link } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useEvidenceLocker } from "@/hooks/use-evidence-locker";

export const Route = createFileRoute("/app/evidence")({
  component: EvidenceLocker,
  head: () => ({
    meta: [
      { title: "ThreatLens · Evidence Locker" },
      {
        name: "description",
        content: "Every artifact you've pinned as evidence across your investigations.",
      },
      { property: "og:title", content: "ThreatLens · Evidence Locker" },
      {
        property: "og:description",
        content: "Pinned evidence, grouped by investigation and MITRE technique.",
      },
    ],
  }),
});

function EvidenceLocker() {
  const { artifacts, stats, coverageBySource, state } = useEvidenceLocker();
  const maxCoverage = Math.max(1, ...coverageBySource.map((c) => c.count));

  return (
    <WorkspacePage
      title="Evidence Locker"
      description="Every artifact you pin as evidence during an investigation, in one place."
      state={state}
      emptyState={{
        title: "No evidence pinned yet",
        description:
          "Open an active investigation and use Pin as Evidence on anything relevant — it'll show up here.",
      }}
      stats={[
        {
          label: "Artifacts pinned",
          value: stats ? String(stats.artifactsCollected) : "—",
        },
        {
          label: "Investigations covered",
          value: stats ? String(stats.investigationsCovered) : "—",
          tone: "info",
        },
        {
          label: "Technique-tagged",
          value: stats ? `${stats.techniqueTaggedPercent}%` : "—",
          tone: "success",
        },
      ]}
      table={{
        title: "Pinned evidence",
        columns: ["Investigation", "Artifact", "MITRE technique", "Justification", "Pinned"],
        rows: artifacts.map((a) => [
          <div key="inv" className="min-w-0">
            <Link
              to="/app/cases/$id"
              params={{ id: a.sessionId }}
              className="truncate font-medium text-[color:var(--info)] hover:underline"
            >
              {a.scenarioTitle}
            </Link>
            <div className="truncate text-[10.5px] text-muted-foreground">{a.incidentTitle}</div>
          </div>,
          <div key="artifact" className="min-w-0">
            <div className="truncate font-medium">{a.title}</div>
            {a.summary && (
              <div className="truncate text-[10.5px] text-muted-foreground">{a.summary}</div>
            )}
          </div>,
          a.mitreTechnique ? (
            <span
              key="mitre"
              className="rounded border border-[color:var(--info)]/40 px-1.5 py-0.5 font-mono text-[10.5px] text-[color:var(--info)]"
            >
              {a.mitreTechnique.techniqueId}
            </span>
          ) : (
            <span key="mitre" className="text-[11px] text-muted-foreground">
              —
            </span>
          ),
          <span key="just" className="text-[11.5px] text-secondary">
            {a.justification}
          </span>,
          <span key="when" className="text-muted-foreground">
            {new Date(a.pinnedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>,
        ]),
      }}
      asides={[
        {
          title: "Coverage by source",
          items: coverageBySource.map((c) => ({
            label: c.label,
            value: String(c.count),
            meter: Math.round((c.count / maxCoverage) * 100),
          })),
        },
      ]}
    />
  );
}
