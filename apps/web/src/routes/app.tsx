import { createFileRoute, Navigate, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/soc/app-shell";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsAuthenticated, useAuthUser } from "@/lib/auth-store";
import { useEntitlement } from "@/hooks/use-billing";
import { onSubscriptionRequired } from "@/lib/api-client";
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

/**
 * Hoisted so each redirect is one element with one props object, for the whole app's life.
 *
 * TanStack's <Navigate> decides whether to fire by comparing its props to the previous ones
 * **by reference**, and JSX builds a fresh props object on every render. A component that
 * unmounts as soon as it redirects never notices. One that stays mounted — this route, whose
 * condition is still true on the next render — calls navigate() again, and each call restarts
 * the pending navigation, which keeps the component mounted, which renders again. The tab
 * locks up on a loop that never settles, which is what signing out used to do.
 *
 * A constant element keeps the same props object across renders, so the reference check
 * short-circuits and the navigation is issued exactly once per mount.
 */
const REDIRECT_TO_LOGIN = <Navigate to="/login" replace />;
const REDIRECT_TO_BILLING = <Navigate to="/app/billing" replace />;

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
  const navigate = useNavigate();
  const { entitlement } = useEntitlement();

  // The redirect below needs GET /billing/me to have answered. This does not: any refusal
  // from any endpoint is the server stating the same thing, so a lapsed account reaches the
  // billing page even on the loads where the entitlement lookup itself was what failed.
  // Without it that account sits on a console whose every panel fails, with nothing saying
  // why and nothing offering the page that fixes it.
  useEffect(
    () =>
      onSubscriptionRequired(() => {
        if (OPEN_WITHOUT_SUBSCRIPTION.some((p) => window.location.pathname.startsWith(p))) return;
        void navigate({ to: "/app/billing", replace: true });
      }),
    [navigate],
  );

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!isAuthenticated) return REDIRECT_TO_LOGIN;

  // Staff run the platform rather than subscribe to it.
  const isStaff = user?.role === "platform_admin";
  const onOpenPage = OPEN_WITHOUT_SUBSCRIPTION.some((p) => location.pathname.startsWith(p));

  // Render immediately and redirect only once the answer says to, rather than holding the
  // console behind a billing request.
  //
  // Blocking on it made every page of the console wait for an extra round trip before
  // anything appeared, which is felt on every load by every paying customer — to spare a
  // lapsed one a brief glimpse of a console that cannot load any data anyway. The server
  // refuses the data regardless, so this redirect decides where somebody is sent, not what
  // they can reach, and it does not need to be the first thing that happens.
  if (!isStaff && !onOpenPage && entitlement && !entitlement.active) {
    return REDIRECT_TO_BILLING;
  }

  return <AppShell />;
}
