import { analysts } from "@/lib/soc-data";
import type { OrganizationsService } from "./organizations-service";

export const mockOrganizationsService: OrganizationsService = {
  listMembers: () => Promise.resolve(analysts),
};
