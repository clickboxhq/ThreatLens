import type { IdentityDto, IdentityProfileDto, SignInEventDto } from "@/types/socverse-operations";

/** Identities are generated per session — each scenario invents its own small "org" of users,
 * so this is always scoped to one investigation, never a global directory. */
export interface IdentitiesService {
  list(sessionId: string): Promise<IdentityDto[]>;
  getSignIns(sessionId: string, identityId: string): Promise<SignInEventDto[]>;
  getProfile(sessionId: string, identityId: string): Promise<IdentityProfileDto>;
}
