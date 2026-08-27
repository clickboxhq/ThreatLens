import type { SearchService } from "./search-service";
import { mockSearchService } from "./mock-search-service";

export const searchService: SearchService = mockSearchService;
export type { SearchService } from "./search-service";
