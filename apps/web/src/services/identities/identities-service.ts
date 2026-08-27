import type { Identity } from "@/types/identities";

export interface IdentitiesService {
  listIdentities(): Identity[];
}
