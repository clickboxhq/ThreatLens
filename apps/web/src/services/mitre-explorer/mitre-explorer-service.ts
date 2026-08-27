import type { MitreMastery, PracticedTechnique } from "@/types/mitre-explorer";

export interface MitreExplorerService {
  listMastery(): Promise<MitreMastery[]>;
  listPracticedTechniques(): Promise<PracticedTechnique[]>;
}
