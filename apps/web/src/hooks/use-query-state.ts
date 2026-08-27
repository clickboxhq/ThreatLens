import type { UseQueryResult } from "@tanstack/react-query";

export type ViewState = "loading" | "error" | "empty" | "ready";

/**
 * Collapses a react-query result into the one state a Group B screen
 * actually renders around. `isEmptyData` lets each call site define what
 * "empty" means for its own shape (empty array, null, zero rows, etc.).
 */
export function deriveViewState<T>(
  query: Pick<UseQueryResult<T>, "data" | "isPending" | "isError">,
  isEmptyData: (data: T) => boolean = (data) => Array.isArray(data) && data.length === 0,
): ViewState {
  if (query.isPending) return "loading";
  if (query.isError) return "error";
  if (query.data === undefined || query.data === null) return "empty";
  if (isEmptyData(query.data)) return "empty";
  return "ready";
}
