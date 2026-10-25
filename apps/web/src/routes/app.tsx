import { createFileRoute, Navigate, useLocation } from "@tanstack/react-router";
import { AppShell } from "@/components/soc/app-shell";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsAuthenticated, useAuthUser } from "@/lib/auth-store";
import { useEntitlement } from "@/hooks/use-billing";
import { Skeleton } from "@/components/soc/ui/skeleton";

export const Route = createFileRoute("/app")({
  component: ProtectedAppShell,
  head: () => ({
    // Defense in depth: the console is a client-only authed area with no
    // indexable content, but make the directive explicit for any crawler that
    // reaches an /app/* URL. The X-Robots-Tag header on non-production hosts
    // (see src/server.ts) covers the SSR shell too.
    meta: [{ title: "ThreatLens · Console" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

/**
 * Pages that stay reachable without a subscription.
 *
 * ThreatLens has no free tier, so the console is behind the paywall — but not the page that
 * takes money, and not the account page someone needs to sign out from. Sending a lapsed
 * customer to a paywall they cannot leave or pay from is the one way this feature can lose
 * the customer it was meant to charge.
 *
 * Mirrors the server's own exemptions in SubscriptionGuard; the API refuses regardless, so
 * this only decides where somebody is sent rather than what they can reach.
 */
const OPEN_WITHOUT_SUBSCRIPTION = ["/app/billing", "/app/settings", "/app/profile"];

// Auth state only exists client-side (see lib/auth-store.ts's own comment on why a
// server-shared singleton can never safely hold it), so this can't be a beforeLoad/loader
// redirect — it's a client-side check-and-redirect, same shape as the pre-merge app's
// ProtectedRoute. Every /app/* route was previously reachable by any anonymous visitor
// (confirmed by the backend-handoff audit before this merge) — this closes that gap.
function ProtectedAppShell() {
  const hydrated = useHydrated();
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthUser();
  const location = useLocation();
  const { entitlement, isPending } = useEntitlement();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Staff run the platform rather than subscribe to it.
  const isStaff = user?.role === "platform_admin";
  const onOpenPage = OPEN_WITHOUT_SUBSCRIPTION.some((p) => location.pathname.startsWith(p));

  // Wait for the answer rather than guessing. Redirecting on a pending query would bounce
  // every paying customer through the billing page on each cold load.
  if (!isStaff && !onOpenPage && isPending) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!isStaff && !onOpenPage && entitlement && !entitlement.active) {
    return <Navigate to="/app/billing" replace />;
  }

  return <AppShell />;
}
