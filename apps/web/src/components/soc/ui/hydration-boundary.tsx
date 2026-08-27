import type { ReactNode } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { Skeleton } from "@/components/soc/ui/skeleton";

/**
 * Wraps a Group A (Zustand/localStorage-backed) route body so it never
 * renders against pre-hydration state. Replaces the old per-route
 * "Loading session…" text with a real skeleton.
 */
export function HydrationBoundary({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  return <>{children}</>;
}
