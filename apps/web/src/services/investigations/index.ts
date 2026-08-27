import { apiInvestigationsService } from "./api-investigations-service";
import type { InvestigationsService } from "./investigations-service";

// No mock left to switch between — this domain now only makes sense wired to the real
// backend (client-side scoring/ground-truth is exactly what had to go away, see the merge
// plan's Phase 2).
export const investigationsService: InvestigationsService = apiInvestigationsService;

export type { InvestigationsService } from "./investigations-service";
