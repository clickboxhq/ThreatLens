import { useQuery } from "@tanstack/react-query";
import { learningCenterService } from "@/services/learning-center";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useLearningCenter() {
  const tracksQuery = useQuery({
    queryKey: [...queryKeys.learningCenter, "tracks"],
    queryFn: () => learningCenterService.listTracks(),
  });
  const achievementsQuery = useQuery({
    queryKey: [...queryKeys.learningCenter, "achievements"],
    queryFn: () => learningCenterService.listAchievements(),
  });
  const certificatesQuery = useQuery({
    queryKey: [...queryKeys.learningCenter, "certificates"],
    queryFn: () => learningCenterService.listCertificates(),
  });
  return {
    tracks: tracksQuery.data ?? [],
    achievements: achievementsQuery.data ?? [],
    certificates: certificatesQuery.data ?? [],
    state: deriveViewState(tracksQuery),
  };
}
