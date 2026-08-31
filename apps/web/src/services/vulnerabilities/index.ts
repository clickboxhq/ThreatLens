import { apiVulnerabilitiesService } from "./api-vulnerabilities-service";
import type { VulnerabilitiesService } from "./vulnerabilities-service";

export const vulnerabilitiesService: VulnerabilitiesService = apiVulnerabilitiesService;

export type { VulnerabilitiesService } from "./vulnerabilities-service";
