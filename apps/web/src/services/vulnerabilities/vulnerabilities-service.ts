import type { VulnerabilityDto, VulnerabilityStatus } from "@/types/socverse-operations";

export interface VulnerabilitiesService {
  list(sessionId: string): Promise<VulnerabilityDto[]>;
  updateStatus(
    sessionId: string,
    vulnerabilityId: string,
    input: { status: VulnerabilityStatus; statusNote?: string },
  ): Promise<VulnerabilityDto>;
}
