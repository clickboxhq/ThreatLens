import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { SessionPicker } from "@/components/soc/session-picker";
import { Skeleton } from "@/components/soc/ui/skeleton";
import { InvestigationGraph } from "@/components/soc/investigation-graph";
import { useActiveSession } from "@/hooks/use-active-session";
import { useInvestigation, useSessionIncident } from "@/hooks/use-investigations";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/graph")({
  component: GraphPage,
  head: () => ({ meta: [{ title: "ThreatLens · Investigation Graph" }] }),
});

/**
 * The Investigation Graph as its own reachable page, not only a panel inside the Case Workspace
 * — useful once a case is well underway or closed, when you want to look at the whole shape of
 * what you built without scrolling past the evidence locker and response actions to see it.
 */
function GraphPage() {
  const { isLoading: sessionsLoading, activeSessions, selectedSessionId, setSelectedSessionId } =
    useActiveSession();

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Investigation Graph" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!selectedSessionId) {
    return <NoActiveSession title="Investigation Graph" />;
  }

  return (
    <GraphPageInner
      sessionId={selectedSessionId}
      activeSessions={activeSessions}
      selectedSessionId={selectedSessionId}
      setSelectedSessionId={setSelectedSessionId}
    />
  );
}

function GraphPageInner({
  sessionId,
  activeSessions,
  selectedSessionId,
  setSelectedSessionId,
}: {
  sessionId: string;
  activeSessions: ReturnType<typeof useActiveSession>["activeSessions"];
  selectedSessionId: string | undefined;
  setSelectedSessionId: (id: string) => void;
}) {
  const { data: incidentSummary, isPending: incidentPending } = useSessionIncident(sessionId);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Investigation Graph"
        description="Every entity and event you've worked with in this investigation, laid out by time and correlation."
        actions={
          <SessionPicker
            sessions={activeSessions}
            selectedId={selectedSessionId}
            onChange={setSelectedSessionId}
          />
        }
      />
      <Panel padded={false}>
        {incidentPending ? (
          <Skeleton className="h-96 m-4" />
        ) : !incidentSummary ? (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            This session has no investigation open yet.
          </div>
        ) : (
          <GraphForIncident sessionId={sessionId} incidentId={incidentSummary.id} />
        )}
      </Panel>
    </div>
  );
}

function GraphForIncident({ sessionId, incidentId }: { sessionId: string; incidentId: string }) {
  const { evidence, timeline, incidentLoading } = useInvestigation(sessionId, incidentId);

  if (incidentLoading) return <Skeleton className="h-96 m-4" />;

  return (
    <div className="p-4">
      <InvestigationGraph timeline={timeline} evidence={evidence} />
      <div className="mt-3 text-right">
        <Link
          to="/app/cases/$id"
          params={{ id: sessionId }}
          className="inline-flex items-center gap-1 text-[11.5px] text-secondary hover:text-foreground"
        >
          Open full case workspace <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  );
}
