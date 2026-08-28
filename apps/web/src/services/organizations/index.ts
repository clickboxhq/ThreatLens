import { apiOrganizationsService } from "./api-organizations-service";
import type { OrganizationsService } from "./organizations-service";

export const organizationsService: OrganizationsService = apiOrganizationsService;

export type { OrganizationsService } from "./organizations-service";
