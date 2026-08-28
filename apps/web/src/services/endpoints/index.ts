import { apiEndpointsService } from "./api-endpoints-service";
import type { EndpointsService } from "./endpoints-service";

export const endpointsService: EndpointsService = apiEndpointsService;

export type { EndpointsService } from "./endpoints-service";
