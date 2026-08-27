import { useSoc } from "@/lib/store";
import type { EndpointsService } from "./endpoints-service";

export const mockEndpointsService: EndpointsService = {
  listEndpoints: () => useSoc.getState().endpoints,
  toggleIsolate: (host) => useSoc.getState().toggleIsolate(host),
};
