import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions";

const keys = {
  mine: ["sessions", "mine"] as const,
};

/** The student's own session history, newest first — backs Case Management and Incident
 * Queue directly, and is what useActiveSession filters down for the Alert Center / portals. */
export function useMySessions() {
  return useQuery({
    queryKey: keys.mine,
    queryFn: () => sessionsService.listMine(),
  });
}
