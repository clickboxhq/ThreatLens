import { useSoc } from "@/lib/store";
import type { IdentitiesService } from "./identities-service";

export const mockIdentitiesService: IdentitiesService = {
  listIdentities: () => useSoc.getState().identities,
};
