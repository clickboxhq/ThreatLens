import { useQuery } from "@tanstack/react-query";
import { searchService } from "@/services/search";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useSearch() {
  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.search, "categories"],
    queryFn: () => searchService.listCategories(),
  });
  const resultsQuery = useQuery({
    queryKey: [...queryKeys.search, "top-results"],
    queryFn: () => searchService.listTopResults(),
  });
  return {
    categories: categoriesQuery.data ?? [],
    topResults: resultsQuery.data ?? [],
    state: deriveViewState(categoriesQuery),
  };
}
