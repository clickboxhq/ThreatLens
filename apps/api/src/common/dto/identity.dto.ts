import type { Identity } from '@prisma/client';

// Explicit allow-list (§18.3). `isGroundTruthActor` is never included — enforced here once,
// not by every caller remembering to strip it.
export interface StudentIdentityDto {
  id: string;
  displayName: string;
  userPrincipalName: string;
  department: string;
  jobTitle: string;
  managerIdentityId: string | null;
  riskLevel: string;
  mfaStatus: string;
  accountStatus: string;
  isPrivileged: boolean;
  homeCountry: string;
}

export function toStudentIdentityDto(identity: Identity): StudentIdentityDto {
  return {
    id: identity.id,
    displayName: identity.displayName,
    userPrincipalName: identity.userPrincipalName,
    department: identity.department,
    jobTitle: identity.jobTitle,
    managerIdentityId: identity.managerIdentityId,
    riskLevel: identity.riskLevel,
    mfaStatus: identity.mfaStatus,
    accountStatus: identity.accountStatus,
    isPrivileged: identity.isPrivileged,
    homeCountry: identity.homeCountry,
  };
}
