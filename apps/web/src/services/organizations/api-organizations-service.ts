import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { OrganizationsService } from "./organizations-service";

export const apiOrganizationsService: OrganizationsService = {
  listMembers: () => {
    throw new NotConnectedError("OrganizationsService.listMembers");
  },
};
