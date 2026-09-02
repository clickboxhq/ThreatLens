import { useState } from "react";
import { Panel } from "@/components/soc/primitives";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import { Loader2, ShieldCheck } from "lucide-react";
import type { IncidentVerdict } from "@/types/threatlens-investigation";
import type { MitreTechniqueDto } from "@/types/threatlens-investigation";

const VERDICTS: { id: IncidentVerdict; label: string; hint: string }[] = [
  { id: "true_positive", label: "True positive", hint: "Malicious activity confirmed with impact" },
  {
    id: "false_positive",
    label: "False positive",
    hint: "Detection fired on non-malicious activity",
  },
  {
    id: "benign_positive",
    label: "Benign positive",
    hint: "Real malicious signal, no impact realised",
  },
];

/**
 * Submit: the formal close of the incident. A deliberate confirm step before the irreversible
 * call — this is the one place in the workflow the brief specifically wants friction, since
 * closeIncident + submitSession together are what the backend uses to lock everything down
 * (assertIncidentEditable rejects every other write path once status is 'closed').
 */
export function StageSubmit({
  mitreTechniques,
  onSubmit,
  submitting,
  verdict,
  setVerdict,
  summary,
  setSummary,
  selectedTechniqueIds,
  setSelectedTechniqueIds,
}: {
  mitreTechniques: MitreTechniqueDto[];
  onSubmit: (input: {
    verdict: IncidentVerdict;
    summary: string;
    mitreTechniqueIds: string[];
  }) => Promise<void>;
  submitting: boolean;
  // Lifted to the parent rather than kept local: this stage unmounts every time the analyst
  // navigates to a different stage in the stepper (each stage is only rendered while active),
  // so a draft kept in local state was silently lost the moment someone went to double-check
  // the Evidence stage before submitting — exactly the "navigate freely without losing work"
  // case the brief calls out.
  verdict: IncidentVerdict | undefined;
  setVerdict: (v: IncidentVerdict) => void;
  summary: string;
  setSummary: (s: string) => void;
  selectedTechniqueIds: string[];
  setSelectedTechniqueIds: (ids: string[] | ((prev: string[]) => string[])) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function validate(): string | null {
    if (!verdict) return "Select a verdict before submitting.";
    if (summary.trim().length < 20) return "The written summary must be at least 20 characters.";
    if (selectedTechniqueIds.length === 0) return "Tag at least one MITRE technique.";
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Panel title="Verdict">
        <div className="flex flex-col gap-1.5">
          {VERDICTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVerdict(v.id)}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                verdict === v.id
                  ? "border-[color:var(--info)]/60 bg-[color:var(--info)]/10"
                  : "border-border bg-background hover:border-border/80"
              }`}
            >
              <div className="text-[13px] font-medium">{v.label}</div>
              <div className="text-[11px] text-muted-foreground">{v.hint}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="MITRE ATT&CK techniques" className="mt-4">
        <div className="flex flex-wrap gap-1.5">
          {mitreTechniques.map((t) => {
            const on = selectedTechniqueIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() =>
                  setSelectedTechniqueIds((prev) =>
                    on ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                  )
                }
                title={`${t.name} · ${t.tactic}`}
                className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                  on
                    ? "border-[color:var(--info)]/60 bg-[color:var(--info)]/10 text-[color:var(--info)]"
                    : "border-border bg-background text-secondary"
                }`}
              >
                {t.techniqueId}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Written summary" className="mt-4">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={7}
          placeholder="What happened, how you know, and what you did about it…"
          className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-[12.5px] leading-relaxed focus:outline-none"
        />
        <div className="mt-1 text-right text-[10.5px] text-muted-foreground">
          {summary.trim().length} characters (20 minimum)
        </div>
      </Panel>

      {formError && (
        <p className="mt-3 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 p-2.5 text-[11.5px]">
          {formError}
        </p>
      )}

      <button
        onClick={() => {
          const err = validate();
          setFormError(err);
          if (!err) setConfirmOpen(true);
        }}
        disabled={submitting}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        Submit investigation
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="default"
        title="Submit investigation?"
        description="Once submitted, this investigation is finalized and scored. You will no longer be able to modify evidence, technique selections, response actions, notes, or your verdict."
        confirmLabel="Submit investigation"
        cancelLabel="Go back"
        onConfirm={async () => {
          if (!verdict) return;
          try {
            await onSubmit({
              verdict,
              summary: summary.trim(),
              mitreTechniqueIds: selectedTechniqueIds,
            });
          } catch (err) {
            setFormError(
              err instanceof ApiError ? err.message : "Could not submit this incident. Try again.",
            );
            throw err;
          }
        }}
      />
    </div>
  );
}
