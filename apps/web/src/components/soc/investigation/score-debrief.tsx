import type { ScoreRubricBreakdown } from "@/types/threatlens-investigation";

const VERDICT_LABEL: Record<string, string> = {
  true_positive: "True positive",
  false_positive: "False positive",
  benign_positive: "Benign positive",
};

function verdictLabel(value: string): string {
  return VERDICT_LABEL[value] ?? value.replace(/_/g, " ");
}

const ACTION_LABEL: Record<string, string> = {
  isolate_device: "Isolate device",
  disable_account: "Disable account",
  force_password_reset: "Force password reset",
  revoke_tokens: "Revoke sessions & tokens",
  block_sender: "Block sender / domain",
  block_ip: "Block IP at egress",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, " ");
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
        : "border-[color:var(--info)]/30 bg-[color:var(--info)]/5";
  return (
    <div className={`rounded-md border p-2.5 ${border}`}>
      <div className="text-[11.5px] font-medium">{title}</div>
      <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{explanation}</p>
      <div className="mt-1.5 text-[10.5px]">{children}</div>
    </div>
  );
}

function TitleList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function ActionList({ items }: { items: { action: string; targetLabel: string }[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((a, i) => (
        <li key={i}>
          <span className="font-medium text-foreground">{actionLabel(a.action)}</span>
          <span className="text-muted-foreground"> → </span>
          {a.targetLabel}
        </li>
      ))}
    </ul>
  );
}

/**
 * What went wrong, and why it cost marks.
 *
 * Every rubric component that can lose marks can also say why: verdict, evidence (missed and
 * unnecessary), techniques (missed and incorrect), and — since triage and containment started
 * being scored for real — the alerts decided wrongly or not at all, and the containment that
 * was missed or not called for. The correlation reveal is the one section that is not about
 * marks: it is the scenario's own grouping of the alerts, shown now that the case is closed so
 * the student can set their triage against it.
 */
export function ScoreDebrief({ breakdown }: { breakdown: ScoreRubricBreakdown }) {
  const {
    missedEvidence,
    missedTechniques,
    incorrectTechniques,
    unnecessaryEvidence,
    verdict,
    triage,
    response,
    correlation,
  } = breakdown;

  const showVerdict = verdict && !verdict.correct;
  const sweptBait = triage?.escalatedBait ?? [];
  const dismissedReal = triage?.dismissedReal ?? [];
  const untouched = triage?.untouched ?? [];
  const missedContainment = response?.missed ?? [];
  const unnecessaryContainment = response?.unnecessary ?? [];
  // Over-containment only costs marks on a false or benign positive (scorer.ts). A true
  // positive with no listed containment — an older scenario version — reports extra actions
  // as neutral, the same as one that does list containment.
  const expectedNone =
    (response?.expected.length ?? 0) === 0 && verdict?.required !== "true_positive";
  const groups = correlation?.groups ?? [];

  const hasAnything =
    missedEvidence.length > 0 ||
    missedTechniques.length > 0 ||
    (incorrectTechniques?.length ?? 0) > 0 ||
    (unnecessaryEvidence?.length ?? 0) > 0 ||
    showVerdict ||
    sweptBait.length > 0 ||
    dismissedReal.length > 0 ||
    untouched.length > 0 ||
    missedContainment.length > 0 ||
    (expectedNone && unnecessaryContainment.length > 0);

  return (
    <div className="mt-4 flex flex-col gap-2">
      {!hasAnything && (
        <p className="text-[11.5px] text-muted-foreground">
          Nothing flagged in the debrief — you triaged every alert correctly, tagged the right
          techniques, collected the right evidence, took the containment the case called for, and
          reached the right verdict.
        </p>
      )}

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

      {sweptBait.length > 0 && (
        <Section
          title={`Planted alerts you treated as the incident (${sweptBait.length})`}
          tone="wrong"
          explanation="These fired on activity the scenario planted as noise. Escalating one — or pinning its evidence — treats noise as signal, which is the mistake triage exists to catch."
        >
          <TitleList items={sweptBait} />
        </Section>
      )}

      {dismissedReal.length > 0 && (
        <Section
          title={`Real alerts you dismissed (${dismissedReal.length})`}
          tone="wrong"
          explanation="These were part of the incident. A dismissal with a reason is still a wrong call when the alert was real."
        >
          <TitleList items={dismissedReal} />
        </Section>
      )}

      {untouched.length > 0 && (
        <Section
          title={`Alerts you never decided on (${untouched.length})`}
          tone="missed"
          explanation="Triage is scored on every alert the case raised. Leaving one undecided earns nothing — in a real queue it is still sitting there for the next shift."
        >
          <TitleList items={untouched} />
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

      {missedContainment.length > 0 && (
        <Section
          title={`Containment you did not take (${missedContainment.length})`}
          tone="missed"
          explanation="The case called for these, against these specific accounts or devices. Response is scored on the right action against the right entity — the same action on the wrong one earns nothing."
        >
          <ActionList items={missedContainment} />
        </Section>
      )}

      {unnecessaryContainment.length > 0 && (
        <Section
          title={`Containment that was not called for (${unnecessaryContainment.length})`}
          tone={expectedNone ? "wrong" : "neutral"}
          explanation={
            expectedNone
              ? "This case warranted no containment at all. Acting on a benign finding has a real cost to the business, and it scores the whole Response component at zero."
              : "Not counted against you here, but worth knowing: over-containment has a cost in a real environment, and none of these matched what the case called for."
          }
        >
          <ActionList items={unnecessaryContainment} />
        </Section>
      )}

      {groups.length > 0 && (
        <Section
          title="How the alerts actually connected"
          tone="neutral"
          explanation="The scenario's own grouping of its alerts — one chain per group — shown now that the case is closed. Set it against what you escalated together."
        >
          <ol className="space-y-1.5">
            {groups.map((g, i) => (
              <li key={i} className="rounded border border-border bg-background/60 px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Chain {i + 1}
                </span>
                <ul className="mt-0.5 space-y-0.5">
                  {g.alertTitles.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}
