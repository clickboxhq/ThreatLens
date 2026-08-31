import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, FileText, Globe, Link as LinkIcon, Mail, Network, UserRound } from "lucide-react";
import { searchService } from "@/services/search";
import { queryKeys } from "./query-keys";
import type { SearchEntityType } from "@/types/socverse-investigation";
import type { SearchCategory } from "@/types/search";

// Exported for reuse by Log Explorer, which needs the same entity-type labels/icons for its
// own (structured, session-scoped) query results.
export const ENTITY_TYPE_META: Record<
  SearchEntityType,
  { label: string; icon: SearchCategory["icon"] }
> = {
    sign_in_event: { label: "Sign-ins", icon: UserRound },
    email_message: { label: "Emails", icon: Mail },
    cloud_event: { label: "Cloud", icon: Globe },
    process_event: { label: "Processes", icon: Cpu },
    file_event: { label: "Files", icon: FileText },
    network_event: { label: "Network", icon: Network },
    http_request: { label: "Web requests", icon: LinkIcon },
  };

export function useSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SearchEntityType | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(handle);
  }, [query]);

  const resultsQuery = useQuery({
    queryKey: [...queryKeys.search, "mine", debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
  });
  const allResults = resultsQuery.data ?? [];

  const counts = new Map<SearchEntityType, number>();
  for (const r of allResults) counts.set(r.entityType, (counts.get(r.entityType) ?? 0) + 1);
  const categories: SearchCategory[] = (Object.keys(ENTITY_TYPE_META) as SearchEntityType[]).map(
    (entityType) => ({
      entityType,
      label: ENTITY_TYPE_META[entityType].label,
      icon: ENTITY_TYPE_META[entityType].icon,
      count: counts.get(entityType) ?? 0,
    }),
  );

  const results = activeCategory
    ? allResults.filter((r) => r.entityType === activeCategory)
    : allResults;

  return {
    query,
    setQuery,
    categories,
    activeCategory,
    setActiveCategory,
    results,
    isPending: resultsQuery.isPending,
  };
}
