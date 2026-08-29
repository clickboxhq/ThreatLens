import { apiClient } from "@/lib/api-client";
import type { ThreatIntelService } from "./threat-intel-service";
import type { ThreatActor, IocSighting } from "@/types/threat-intel-page";

export const apiThreatIntelService: ThreatIntelService = {
  listMine: () =>
    apiClient.get<{ indicators: IocSighting[]; actors: ThreatActor[] }>("/threat-intel/mine"),
};
