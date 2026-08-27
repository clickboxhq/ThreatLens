import type { InvestigationsService } from "./investigations-service";
import { mockInvestigationsService } from "./mock-investigations-service";

// The one line that flips to a real backend later.
export const investigationsService: InvestigationsService = mockInvestigationsService;

export type { InvestigationsService } from "./investigations-service";
