import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminAnalyticsService } from "@/services/admin-analytics";
import { queryKeys } from "./query-keys";
import type { CustomerQuery } from "@/types/admin-analytics";

export function usePlatformOverview() {
  const query = useQuery({
    queryKey: [...queryKeys.adminAnalytics, "overview"],
    queryFn: () => adminAnalyticsService.getOverview(),
    // A 403 (not a platform admin) won't resolve on retry.
    retry: false,
  });
  return {
    overview: query.data,
    isPending: query.isPending,
    isError: query.isError,
  };
}

const PAGE_SIZE = 20;

export function usePlatformCustomers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CustomerQuery["type"]>(undefined);
  const [sort, setSort] = useState<NonNullable<CustomerQuery["sort"]>>("newest");

  const query = useQuery({
    queryKey: [...queryKeys.adminAnalytics, "customers", { page, search, type, sort }],
    queryFn: () =>
      adminAnalyticsService.getCustomers({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        type,
        sort,
      }),
    retry: false,
    placeholderData: keepPreviousData,
  });

  return {
    customers: query.data,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    page,
    setPage,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    type,
    setType: (value: CustomerQuery["type"]) => {
      setType(value);
      setPage(1);
    },
    sort,
    setSort,
    pageSize: PAGE_SIZE,
  };
}
