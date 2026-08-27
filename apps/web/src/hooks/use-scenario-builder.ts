import { useQuery } from "@tanstack/react-query";
import { scenarioBuilderService } from "@/services/scenario-builder";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useScenarioBuilder() {
  const sourcesQuery = useQuery({
    queryKey: [...queryKeys.scenarioBuilder, "sources"],
    queryFn: () => scenarioBuilderService.listEventSources(),
  });
  const timelineQuery = useQuery({
    queryKey: [...queryKeys.scenarioBuilder, "timeline"],
    queryFn: () => scenarioBuilderService.listDraftTimeline(),
  });
  const configQuery = useQuery({
    queryKey: [...queryKeys.scenarioBuilder, "config"],
    queryFn: () => scenarioBuilderService.listConfig(),
  });
  const validationQuery = useQuery({
    queryKey: [...queryKeys.scenarioBuilder, "validation"],
    queryFn: () => scenarioBuilderService.listValidationMessages(),
  });
  return {
    eventSources: sourcesQuery.data ?? [],
    draftTimeline: timelineQuery.data ?? [],
    config: configQuery.data ?? [],
    validationMessages: validationQuery.data ?? [],
    state: deriveViewState(sourcesQuery),
  };
}
