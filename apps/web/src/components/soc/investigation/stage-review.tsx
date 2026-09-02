import { Panel } from "@/components/soc/primitives";
import { InvestigationChecklist, type GuidanceLevel } from "@/components/soc/investigation-checklist";
import { ActivityLogPanel } from "@/components/soc/activity-log-panel";
import type { Stage } from "./investigation-stepper";

/**
 * Review: the completeness gate before Submit. Reuses the existing InvestigationChecklist
 * component as-is (guided/independent mode, collapse behavior, and all) rather than
 * reimplementing task rendering — it already is a review/completeness gate, just previously
 * stranded in the old right rail. Forcing `guidance="full"` here regardless of career level:
 * Review is the one place in the new workflow an analyst deliberately came to check
 * completeness, so it should never collapse itself away — independent-mode senior analysts see
 * this stage rarely, by staying out of their way everywhere else in the stepper.
 */
export function StageReview({
  sessionId,
  incidentId,
  locked,
  evidenceCount,
  timelineCount,
  actionsCount,
  notesCount,
  hintsUsed,
  onNavigate,
}: {
  sessionId: string | undefined;
  incidentId: string | undefined;
  locked: boolean;
  evidenceCount: number;
  timelineCount: number;
  actionsCount: number;
  notesCount: number;
  hintsUsed: number;
  onNavigate: (stage: Stage) => void;
}) {
  const summaryRows: { label: string; count: number; stage: Stage }[] = [
    { label: "Evidence pinned", count: evidenceCount, stage: "evidence" },
    { label: "Timeline entries", count: timelineCount, stage: "evidence" },
    { label: "Response actions taken", count: actionsCount, stage: "response" },
    { label: "Analyst notes", count: notesCount, stage: "notes" },
    { label: "Hints used", count: hintsUsed, stage: "investigate" },
  ];
  const guidance: GuidanceLevel = "full";

  return (
    <div className="mx-auto max-w-2xl">
      <InvestigationChecklist sessionId={sessionId} incidentId={incidentId} locked={locked} guidance={guidance} />

      <Panel title="Investigation summary" className="mt-4">
        <ul className="flex flex-col divide-y divide-border">
          {summaryRows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-2.5 text-[12.5px]">
              <span className="text-secondary">{r.label}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{r.count}</span>
                <button
                  onClick={() => onNavigate(r.stage)}
                  className="text-[11px] text-[color:var(--info)] hover:underline"
                >
                  Review
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Once everything above looks right, move to Submit to select your verdict, tag MITRE
          techniques, and close this incident.
        </p>
      </Panel>

      <div className="mt-4">
        <ActivityLogPanel sessionId={sessionId} />
      </div>
    </div>
  );
}
