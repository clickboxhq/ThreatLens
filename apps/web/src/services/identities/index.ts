import type { IdentitiesService } from "./identities-service";
import { mockIdentitiesService } from "./mock-identities-service";

export const identitiesService: IdentitiesService = mockIdentitiesService;
export type { IdentitiesService } from "./identities-service";
