import { apiNetworkService } from "./api-network-service";
import type { NetworkService } from "./network-service";

export const networkService: NetworkService = apiNetworkService;

export type { NetworkService } from "./network-service";
