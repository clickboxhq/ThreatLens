import { useQuery } from "@tanstack/react-query";
import { feedbackService } from "@/services/feedback";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useFeedback() {
  const query = useQuery({
    queryKey: queryKeys.feedback,
    queryFn: () => feedbackService.listFeedback(),
  });
  return { ...query, feedback: query.data ?? [], state: deriveViewState(query) };
}
