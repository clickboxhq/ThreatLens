import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Coarse, route-level RBAC (§15.2) — is this role ever allowed to call this route.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
