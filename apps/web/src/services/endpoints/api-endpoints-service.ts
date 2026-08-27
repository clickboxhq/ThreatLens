import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { EndpointsService } from "./endpoints-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`EndpointsService.${method}`);
};

export const apiEndpointsService: EndpointsService = {
  listEndpoints: () => notConnected("listEndpoints"),
  toggleIsolate: () => notConnected("toggleIsolate"),
};
