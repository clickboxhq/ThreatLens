import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SITE_NAME, PUBLISHER_NAME, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_ALT } from "../lib/seo";
import { CookieConsent } from "@/components/soc/marketing/cookie-consent";
import { Toaster } from "@/components/ui/sonner";
import { useAuthHydration } from "@/lib/auth-store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Only page-invariant metadata lives here. Anything page-specific — title,
    // description, canonical, og:url, og:title/description — comes from the
    // `seo()` helper in each route so there is exactly one authoritative value
    // per page (see src/lib/seo.ts). The entries below are fallbacks for routes
    // that don't call `seo()` (e.g. the authenticated /app console).
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${SITE_NAME} — SOC & Cybersecurity Investigation Training Platform` },
      {
        name: "description",
        content:
          "ThreatLens is a SOC and cybersecurity investigation training platform. Practice realistic threat hunting and incident investigation across identity, endpoint, email, and cloud — graded against a hidden ground truth.",
      },
      { name: "author", content: PUBLISHER_NAME },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: `${SITE_NAME} — SOC & Cybersecurity Investigation Training Platform`,
      },
      {
        property: "og:description",
        content:
          "Realistic SOC investigations across identity, endpoint, email, and cloud — graded against a hidden ground truth.",
      },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: DEFAULT_OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: `${SITE_NAME} — SOC & Cybersecurity Investigation Training Platform`,
      },
      {
        name: "twitter:description",
        content:
          "Realistic SOC investigations across identity, endpoint, email, and cloud — graded against a hidden ground truth.",
      },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/brand-mark.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.min.css",
      },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // This effect only runs on a genuine full document load (initial load or
  // browser refresh) -- RootComponent persists across client-side route
  // transitions, so this never fires on normal in-app navigation. Without
  // it, the router's scroll restoration can reopen a refreshed page at a
  // previously-scrolled position instead of the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useAuthHydration();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <CookieConsent />
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </QueryClientProvider>
  );
}
