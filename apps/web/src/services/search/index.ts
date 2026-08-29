import { apiSearchService } from "./api-search-service";
import type { SearchService } from "./search-service";

export const searchService: SearchService = apiSearchService;
export type { SearchService } from "./search-service";
