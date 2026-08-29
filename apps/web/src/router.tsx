import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "./lib/api-client";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Never retry a client error — a 404/403/401 won't become a 200 by asking again, and
        // retrying keeps the query in `pending` (i.e. showing a loading spinner) long after
        // the real answer is known. This is what made a case workspace for a deleted or
        // mistyped session sit on "Generating your scenario…" instead of settling on its own
        // "Could not load this session" branch. Server/network errors still get the default
        // 3 attempts, since those genuinely can succeed on retry.
        retry: (failureCount, error) =>
          error instanceof ApiError && error.status < 500 ? false : failureCount < 3,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
