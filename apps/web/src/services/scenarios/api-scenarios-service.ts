import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { ScenariosService } from "./scenarios-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`ScenariosService.${method}`);
};

export const apiScenariosService: ScenariosService = {
  listScenarios: () => notConnected("listScenarios"),
  getProgress: () => notConnected("getProgress"),
  setProgress: () => notConnected("setProgress"),
};
