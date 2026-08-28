import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { CohortPicker } from "@/components/soc/cohort-picker";
import { NoCohorts } from "@/components/soc/no-cohorts";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useSelectedCohort, useReviewQueue, useSubmitFeedback } from "@/hooks/use-instructor";
import { investigationsService } from "@/services/investigations";
import type { ReviewQueueItemDto } from "@/types/socverse-instructor";

export const Route = createFileRoute("/app/feedback")({
  component: FeedbackCenter,
  head: () => ({
    meta: [
      { title: "ThreatLens · Feedback Center" },
      {
        name: "description",
        content: "Review a submitted investigation and send the analyst feedback.",
      },
      { property: "og:title", content: "ThreatLens · Feedback Center" },
      { property: "og:description", content: "Instructor feedback on submitted investigations." },
    ],
  }),
});

function FeedbackCenter() {
  const { isLoading, cohorts, selectedCohort, selectedCohortId, setSelectedCohortId } =
    useSelectedCohort();
  const queueQuery = useReviewQueue(selectedCohortId);
  const [selected, setSelected] = useState<ReviewQueueItemDto>();

  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Feedback Center" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedCohortId) {
    return <NoCohorts title="Feedback Center" />;
  }

  const items = queueQuery.data ?? [];

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Feedback Center"
        description={`Submitted work for ${selectedCohort?.name} — pick one to review.`}
        actions={
          <CohortPicker
            cohorts={cohorts}
            selectedId={selectedCohortId}
            onChange={setSelectedCohortId}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel padded={false}>
          {queueQuery.isPending ? (
            <div className="flex flex-col gap-px p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Nothing to review"
              description="No submissions are waiting in this cohort."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li
                  key={i.sessionId}
                  onClick={() => setSelected(i)}
                  className={`cursor-pointer px-4 py-3 hover:bg-background/40 ${i.sessionId === selected?.sessionId ? "bg-background/40" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{i.studentDisplayName}</span>
                    <span className="tabular-nums text-secondary">
                      {i.overallPercent == null ? "—" : `${Math.round(i.overallPercent)}%`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {i.scenarioTitle}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {selected ? (
          <FeedbackForm key={selected.sessionId} item={selected} />
        ) : (
          <Panel>
            <p className="text-[12px] text-secondary">Select a submission to leave feedback.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function FeedbackForm({ item }: { item: ReviewQueueItemDto }) {
  const [comment, setComment] = useState("");
  const [reopenSession, setReopenSession] = useState(false);
  const submitFeedback = useSubmitFeedback(undefined);

  // Feedback is keyed by incident, not session — SOCVerse opens exactly one incident per
  // session (see the Phase 2 merge notes), so this resolves the id the review queue doesn't
  // return directly, reusing the same lookup the case workspace itself uses.
  const incidentQuery = useQuery({
    queryKey: ["session", item.sessionId, "incidents"],
    queryFn: () => investigationsService.listIncidents(item.sessionId),
  });
  const incidentId = incidentQuery.data?.[0]?.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentId) return;
    submitFeedback.mutate({ incidentId, comment: comment.trim() || undefined, reopenSession });
  };

  return (
    <Panel title={item.studentDisplayName}>
      <p className="text-[12px] text-secondary">{item.scenarioTitle}</p>

      {incidentQuery.isPending ? (
        <Skeleton className="mt-3 h-24" />
      ) : !incidentId ? (
        <p className="mt-3 text-[12px] text-[color:var(--critical)]">
          Couldn't find this submission's incident.
        </p>
      ) : submitFeedback.isSuccess ? (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] text-[color:var(--success)]">Feedback sent.</p>
          {submitFeedback.data.map((f) => (
            <div key={f.id} className="rounded-md border border-border bg-background/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">
                {f.instructorDisplayName} · {new Date(f.createdAt).toLocaleString()}
              </div>
              {f.comment && <p className="mt-1 text-[12.5px]">{f.comment}</p>}
              {f.reopenedSession && (
                <p className="mt-1 text-[11px] text-[color:var(--warning)]">
                  Session reopened for revision.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did they get right? What should they revisit?"
            rows={5}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none"
          />
          <label className="flex items-center gap-2 text-[12px] text-secondary">
            <input
              type="checkbox"
              checked={reopenSession}
              onChange={(e) => setReopenSession(e.target.checked)}
            />
            Reopen this investigation so they can revise it
          </label>
          <button
            type="submit"
            disabled={submitFeedback.isPending}
            className="h-9 self-start rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {submitFeedback.isPending ? "Sending…" : "Send feedback"}
          </button>
          {submitFeedback.isError && (
            <p className="text-[12px] text-[color:var(--critical)]">
              Couldn't send that feedback — try again.
            </p>
          )}
        </form>
      )}
    </Panel>
  );
}
