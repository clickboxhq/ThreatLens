import type { NetworkEventDto } from "@/types/socverse-operations";

/** Network Center — every connection recorded across every device in one investigation, the
 * session-wide counterpart to endpointsService.getNetwork's per-device view. */
export interface NetworkService {
  list(sessionId: string): Promise<NetworkEventDto[]>;
}
