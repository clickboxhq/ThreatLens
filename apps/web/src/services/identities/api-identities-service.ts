import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { IdentitiesService } from "./identities-service";

export const apiIdentitiesService: IdentitiesService = {
  listIdentities: () => {
    throw new NotConnectedError("IdentitiesService.listIdentities");
  },
};
