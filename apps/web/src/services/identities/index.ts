import { apiIdentitiesService } from "./api-identities-service";
import type { IdentitiesService } from "./identities-service";

export const identitiesService: IdentitiesService = apiIdentitiesService;

export type { IdentitiesService } from "./identities-service";
