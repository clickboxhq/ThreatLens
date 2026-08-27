import type { EndpointsService } from "./endpoints-service";
import { mockEndpointsService } from "./mock-endpoints-service";

export const endpointsService: EndpointsService = mockEndpointsService;
export type { EndpointsService } from "./endpoints-service";
