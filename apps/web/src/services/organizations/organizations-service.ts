import type { Analyst } from "@/types/organizations";

export interface OrganizationsService {
  listMembers(): Promise<Analyst[]>;
}
