import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { SearchService } from "./search-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`SearchService.${method}`);
};

export const apiSearchService: SearchService = {
  listCategories: () => notConnected("listCategories"),
  listTopResults: () => notConnected("listTopResults"),
};
