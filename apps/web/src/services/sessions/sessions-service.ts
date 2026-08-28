import type { SessionListItemDto } from "@/types/socverse-operations";

/** The student's own session history — backs Case Management, Incident Queue, and resolving
 * which session the Alert Center / investigation portals should currently show. */
export interface SessionsService {
  listMine(): Promise<SessionListItemDto[]>;
}
