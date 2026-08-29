import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { listRealScenarios } from "@/services/scenario-catalog/scenario-catalog-service";
import { useLaunchScenario } from "@/hooks/use-investigations";
import { ApiError } from "@/lib/api-client";
import { Clock, Loader2, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/app/scenarios")({
  component: ScenarioLib,
  head: () => ({ meta: [{ title: "ThreatLens · Scenario Library" }] }),
});

function ScenarioLib() {
  const navigate = useNavigate();
  const { data: scenarios, isPending } = useQuery({
    queryKey: ["scenarios"],
    queryFn: listRealScenarios,
  });
  const launch = useLaunchScenario();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLaunch(scenarioId: string) {
    setError(null);
    setLaunchingId(scenarioId);
    try {
      const { sessionId } = await launch.mutateAsync(scenarioId);
      navigate({ to: "/app/cases/$id", params: { id: sessionId } });
    } catch (err) {
      setLaunchingId(null);
      if (err instanceof ApiError && err.code === "EMAIL_VERIFICATION_REQUIRED") {
        setError(
          "Verify your email address before starting a scenario — check the banner at the top of the page.",
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Could not start this scenario.");
      }
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Scenario Library"
        description="Real, published SOCVerse scenarios across identity, endpoint, cloud, and email."
      />

      {error && (
        <p className="mb-4 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 p-3 text-[12.5px]">
          {error}
        </p>
      )}

      {isPending ? (
        <p className="text-[12.5px] text-secondary">Loading scenarios…</p>
      ) : !scenarios || scenarios.length === 0 ? (
        <p className="text-[12.5px] text-secondary">No published scenarios yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((s) => (
            <Panel key={s.id}>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="rounded border border-border bg-background px-1.5 py-0.5">
                  {s.category}
                </span>
              </div>
              <h3 className="mt-2 text-[14.5px] font-medium leading-snug">{s.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-[12px] text-secondary">{s.summary}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Difficulty</div>
                  <div className="mt-0.5 font-medium capitalize">{s.difficulty}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Duration</div>
                  <div className="mt-0.5 flex items-center gap-1 font-medium">
                    <Clock className="size-3" /> ~{s.estimatedMinutes} min
                  </div>
                </div>
              </div>
              <button
                disabled={launchingId === s.id}
                onClick={() => handleLaunch(s.id)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {launchingId === s.id ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <PlayCircle className="size-4" /> Launch investigation
                  </>
                )}
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
