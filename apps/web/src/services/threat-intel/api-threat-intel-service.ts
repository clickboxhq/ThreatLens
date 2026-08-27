import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { ThreatIntelService } from "./threat-intel-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`ThreatIntelService.${method}`);
};

export const apiThreatIntelService: ThreatIntelService = {
  listActors: () => notConnected("listActors"),
  listIocs: () => notConnected("listIocs"),
};
