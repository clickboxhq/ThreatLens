import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/soc/app-shell";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsAuthenticated } from "@/lib/auth-store";
import { Skeleton } from "@/components/soc/ui/skeleton";

export const Route = createFileRoute("/app")({
  component: ProtectedAppShell,
  head: () => ({
    meta: [{ title: "ThreatLens · Console" }],
  }),
});

// Auth state only exists client-side (see lib/auth-store.ts's own comment on why a
// server-shared singleton can never safely hold it), so this can't be a beforeLoad/loader
// redirect — it's a client-side check-and-redirect, same shape as the pre-merge app's
// ProtectedRoute. Every /app/* route was previously reachable by any anonymous visitor
// (confirmed by the backend-handoff audit before this merge) — this closes that gap.
function ProtectedAppShell() {
  const hydrated = useHydrated();
  const isAuthenticated = useIsAuthenticated();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}
