import type {
  IdentityDto,
  IdentityProfileDto,
  SignInEventDto,
  CloudEventDto,
  DirectoryAuditEventDto,
  EntityInsightDto,
} from "@/types/threatlens-operations";

/** Identities are generated per session — each scenario invents its own small "org" of users,
 * so this is always scoped to one investigation, never a global directory. */
export interface IdentitiesService {
  list(sessionId: string): Promise<IdentityDto[]>;
  getSignIns(sessionId: string, identityId: string): Promise<SignInEventDto[]>;
  getProfile(sessionId: string, identityId: string): Promise<IdentityProfileDto>;
  /** Cloud-plane activity for this identity — the pivot cloud scenarios turn on. */
  getCloudEvents(sessionId: string, identityId: string): Promise<CloudEventDto[]>;
  /** The directory audit trail for this account — what was done to it, and by whom. */
  getAuditEvents(sessionId: string, identityId: string): Promise<DirectoryAuditEventDto[]>;
  /** Analyst questions with computed answers — see EntityInsightDto. */
  getInsights(sessionId: string, identityId: string): Promise<EntityInsightDto[]>;
}
