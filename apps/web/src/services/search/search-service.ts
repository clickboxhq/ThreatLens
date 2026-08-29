import type { GlobalSearchResult } from "@/types/search";

export interface SearchService {
  /** Empty string returns everything (matches the backend's own "no filters" behavior). */
  search(freetext: string): Promise<GlobalSearchResult[]>;
}
