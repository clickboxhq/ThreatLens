import { apiThreatIntelService } from "./api-threat-intel-service";
import type { ThreatIntelService } from "./threat-intel-service";

export const threatIntelService: ThreatIntelService = apiThreatIntelService;
export type { ThreatIntelService } from "./threat-intel-service";
