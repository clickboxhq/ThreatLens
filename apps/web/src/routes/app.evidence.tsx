import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { SeverityBadge } from "@/components/soc/primitives";
import { useEvidenceLocker } from "@/hooks/use-evidence-locker";
import { Download } from "lucide-react";

export const Route = createFileRoute("/app/evidence")({
  component: EvidenceLocker,
  head: () => ({
    meta: [
      { title: "ThreatLens · Evidence Locker" },
      {
        name: "description",
        content: "Chain-of-custody store for artifacts collected during SOC investigations.",
      },
      { property: "og:title", content: "ThreatLens · Evidence Locker" },
      {
        property: "og:description",
        content: "Artifacts, hashes, and chain of custody for every investigation.",
      },
    ],
  }),
});

function EvidenceLocker() {
  const { artifacts, stats, coverageBySource, gradingImpact, state } = useEvidenceLocker();
  return (
    <WorkspacePage
      title="Evidence Locker"
      description="Every artifact you collect is hashed, timestamped, and bound to an investigation for grading."
      state={state}
      actions={
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary hover:text-foreground">
          <Download className="size-3.5" /> Export manifest
        </button>
      }
      stats={[
        {
          label: "Artifacts collected",
          value: stats ? String(stats.artifactsCollected) : "—",
          delta: "+18 this week",
        },
        {
          label: "Collection rate",
          value: stats ? `${stats.collectionRate}%` : "—",
          delta: "+6% this month",
          tone: "success",
        },
        {
          label: "Required outstanding",
          value: stats ? String(stats.requiredOutstanding) : "—",
          delta: "across 3 investigations",
          tone: "high",
        },
        {
          label: "Chain of custody",
          value: stats ? `${stats.chainOfCustody}%` : "—",
          delta: "verified",
          tone: "success",
        },
      ]}
      table={{
        title: "Collected artifacts",
        columns: [
          "ID",
          "Artifact",
          "Type",
          "Investigation",
          "Severity",
          "SHA-256",
          "Collected by",
          "When",
        ],
        rows: artifacts.map((a) => [
          <span className="font-mono text-[11px] text-muted-foreground">{a.id}</span>,
          <span className="font-medium">{a.name}</span>,
          a.type,
          <span className="font-mono text-[11px] text-secondary">{a.inv}</span>,
          <SeverityBadge level={a.sev} />,
          <span className="font-mono text-[11px] text-muted-foreground">{a.hash}</span>,
          a.who,
          <span className="text-muted-foreground">{a.when}</span>,
        ]),
      }}
      asides={[
        { title: "Coverage by source", items: coverageBySource },
        { title: "Grading impact", items: gradingImpact },
      ]}
    />
  );
}
