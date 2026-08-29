import { apiClient } from "@/lib/api-client";
import { labelForResult, detailForResult } from "@/lib/search-result-format";
import type { SearchService } from "./search-service";
import type { GlobalSearchResult } from "@/types/search";
import type { SearchEntityType } from "@/types/socverse-investigation";

interface RawGlobalSearchResult {
  entityType: SearchEntityType;
  occurredAt: string;
  sessionId: string;
  scenarioTitle: string;
  data: Record<string, unknown>;
}

export const apiSearchService: SearchService = {
  search: async (freetext) => {
    const { results } = await apiClient.post<{ results: RawGlobalSearchResult[] }>(
      "/search/mine",
      freetext ? { freetext } : {},
    );
    return results.map((r): GlobalSearchResult => ({
      entityType: r.entityType,
      occurredAt: r.occurredAt,
      sessionId: r.sessionId,
      scenarioTitle: r.scenarioTitle,
      title: labelForResult(r.entityType, r.data),
      meta: `${detailForResult(r.entityType, r.data)} · ${r.scenarioTitle}`,
    }));
  },
};
