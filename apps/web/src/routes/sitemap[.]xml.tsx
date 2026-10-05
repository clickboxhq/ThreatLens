import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

// Dynamic sitemap. Generated from one canonical list rather than a checked-in
// XML file so it can never drift from the routes that actually exist.
//
// Included: public, indexable marketing pages only.
// Excluded on purpose: /login, /signup, /welcome, password-reset / email-verify
// / invitation routes (transient, per-user), the whole authenticated /app/*
// console, admin, /verify/$id (per-holder, noindex), and the legal pages
// (/privacy, /terms, /cookies, /data-processing — noindex by product choice).
//
// No <lastmod>: we don't track per-route content-change timestamps, and a
// fabricated date is worse than an absent one.
const PUBLIC_PATHS = [
  "/",
  "/platform",
  "/investigations",
  "/correlation",
  "/scoring",
  "/students",
  "/institutions",
  "/instructors",
  "/contact",
  "/security",
];

function renderSitemap(): string {
  const body = PUBLIC_PATHS.map(
    (path) => `  <url>\n    <loc>${SITE_URL}${path}</loc>\n  </url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(renderSitemap(), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
