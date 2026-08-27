import type { Endpoint } from "@/types/endpoints";

export interface EndpointsService {
  listEndpoints(): Endpoint[];
  toggleIsolate(host: string): void;
}
