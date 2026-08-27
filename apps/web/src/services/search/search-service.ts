import type { SearchCategory, SearchResult } from "@/types/search";

export interface SearchService {
  listCategories(): Promise<SearchCategory[]>;
  listTopResults(): Promise<SearchResult[]>;
}
