import { useQuery } from "@tanstack/react-query";
import { profileService } from "@/services/profile";
import { certificatesService } from "@/services/certificates";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useProfile() {
  const summaryQuery = useQuery({
    queryKey: [...queryKeys.profile, "summary"],
    queryFn: () => profileService.getSummary(),
  });
  const skillsQuery = useQuery({
    queryKey: [...queryKeys.profile, "skills"],
    queryFn: () => profileService.listSkillMastery(),
  });
  const certificatesQuery = useQuery({
    queryKey: queryKeys.certificates,
    queryFn: () => certificatesService.listCertificates(),
  });
  return {
    summary: summaryQuery.data,
    skillMastery: skillsQuery.data ?? [],
    certificates: certificatesQuery.data ?? [],
    state: deriveViewState(summaryQuery),
  };
}
