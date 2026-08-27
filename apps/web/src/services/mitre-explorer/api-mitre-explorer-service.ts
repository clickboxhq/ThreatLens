import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { MitreExplorerService } from "./mitre-explorer-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`MitreExplorerService.${method}`);
};

export const apiMitreExplorerService: MitreExplorerService = {
  listMastery: () => notConnected("listMastery"),
  listPracticedTechniques: () => notConnected("listPracticedTechniques"),
};
