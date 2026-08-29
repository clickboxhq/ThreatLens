import { apiMitreExplorerService } from "./api-mitre-explorer-service";
import type { MitreExplorerService } from "./mitre-explorer-service";

export const mitreExplorerService: MitreExplorerService = apiMitreExplorerService;
export type { MitreExplorerService } from "./mitre-explorer-service";
