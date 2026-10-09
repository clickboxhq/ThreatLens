import type { ScoreRubricBreakdown } from "@/types/threatlens-investigation";

const VERDICT_LABEL: Record<string, string> = {
  true_positive: "True positive",
  false_positive: "False positive",
  benign_positive: "Benign positive",
};

function verdictLabel(value: string): string {
  return VERDICT_LABEL[value] ?? value.replace(/_/g, " ");
}

function Section({
  title,
  tone,
  explanation,
  children,
}: {
  title: string;
  tone: "missed" | "wrong" | "neutral";
  /** Why it cost marks — a list of items alone does not teach anything. */
  explanation: string;
  children: React.ReactNode;
}) {
  const border =
    tone === "missed"
      ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10"
      : tone === "wrong"
        ? "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10"
        : "border-border bg-background";
  return (
    <div className={`rounded-md border p-2.5 ${border}`}>
      <div className="text-[11.5px] font-medium">{title}</div>
      <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{explanation}</p>
      <div className="mt-1.5 text-[10.5px]">{children}</div>
    </div>
  );
}

/**
 * What went wrong, and why it cost marks.
 *
 * This panel used to show two things, both of them absences: evidence you did not pin and
 * techniques you did not tag. A Student who missed nothing but over-tagged — which is what
 * tagging every plausible technique produces, and the most common way to lose marks here —
 * got a score in the fifties with an entirely blank debrief beneath it. Precision and verdict
 * are now explained too, so every component that can lose marks can also say why.
 */
export function ScoreDebrief({ breakdown }: { breakdown: ScoreRubricBreakdown }) {
  const { missedEvidence, missedTechniques, incorrectTechniques, unnecessaryEvidence, verdict } =
    breakdown;

  const showVerdict = verdict && !verdict.correct;
  const hasAnything =
    missedEvidence.length > 0 ||
    missedTechniques.length > 0 ||
    (incorrectTechniques?.length ?? 0) > 0 ||
    (unnecessaryEvidence?.length ?? 0) > 0 ||
    showVerdict;

  if (!hasAnything) {
    return (
      <p className="mt-4 text-[11.5px] text-muted-foreground">
        Nothing flagged in the debrief — you tagged the right techniques, collected the right
        evidence, and reached the right verdict.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {showVerdict && (
        <Section
          title="Your verdict was not the expected one"
          tone="wrong"
          explanation="The verdict is how you classified the incident overall. Compare what the evidence actually showed against how you labelled it."
        >
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>
              You submitted{" "}
              <span className="font-medium text-foreground">
                {verdict.submitted.length
                  ? verdict.submitted.map(verdictLabel).join(", ")
                  : "no verdict"}
              </span>
            </span>
            <span>
              Expected{" "}
              <span className="font-medium text-[color:var(--success)]">
                {verdictLabel(verdict.required)}
              </span>
            </span>
          </div>
        </Section>
      )}

      {missedEvidence.length > 0 && (
        <Section
          title={`Evidence you did not collect (${missedEvidence.length})`}
          tone="missed"
          explanation="These events were part of the attack. Finding them is what evidence recall measures."
        >
          <ul className="list-disc space-y-0.5 pl-4">
            {missedEvidence.map((e, i) => (
              <li key={i}>{e.summary}</li>
            ))}
          </ul>
        </Section>
      )}

      {(unnecessaryEvidence?.length ?? 0) > 0 && (
        <Section
          title={`Evidence you collected that was not relevant (${unnecessaryEvidence!.length})`}
          tone="wrong"
          explanation="Scenarios plant benign activity on purpose. Collecting it lowers evidence precision — in a real SOC it is the noise that buries the signal."
        >
          <ul className="list-disc space-y-0.5 pl-4">
            {unnecessaryEvidence!.map((e, i) => (
              <li key={i}>{e.summary}</li>
            ))}
          </ul>
        </Section>
      )}

      {missedTechniques.length > 0 && (
        <Section
          title={`Techniques you did not tag (${missedTechniques.length})`}
          tone="missed"
          explanation="These ATT&CK techniques were used in this incident."
        >
          <ul className="space-y-0.5">
            {missedTechniques.map((t) => (
              <li key={t.id}>
                <span className="font-mono text-[color:var(--info)]">{t.techniqueId}</span> {t.name}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(incorrectTechniques?.length ?? 0) > 0 && (
        <Section
          title={`Techniques you tagged that were not used (${incorrectTechniques!.length})`}
          tone="wrong"
          explanation="Tagging everything plausible costs as much as tagging too little — technique accuracy averages how much you found with how much of what you named was right."
        >
          <ul className="space-y-0.5">
            {incorrectTechniques!.map((t) => (
              <li key={t.id}>
                <span className="font-mono text-[color:var(--danger)]">{t.techniqueId}</span>{" "}
                {t.name}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
