import { mitreMastery } from "@/lib/soc-data";
import { mitreTechniques } from "@/services/investigations/telemetry-data";
import type { MitreExplorerService } from "./mitre-explorer-service";

export const mockMitreExplorerService: MitreExplorerService = {
  listMastery: () => Promise.resolve(mitreMastery),
  listPracticedTechniques: () =>
    Promise.resolve(
      mitreTechniques.map((t, i) => ({
        ...t,
        mastery: 58 + ((i * 13) % 40),
        practicedCount: 2 + (i % 6),
      })),
    ),
};
