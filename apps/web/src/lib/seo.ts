// Single source of truth for public-facing SEO / social metadata.
//
// TanStack Router merges each route's `head()` output from leaf -> root, deduping
// meta by `name`/`property` (leaf wins) but deduping <link> tags only by exact
// equality. That means a per-page `<link rel="canonical">` MUST NOT coexist with a
// hardcoded one in __root.tsx or both render. __root.tsx therefore carries only
// the parts that are identical on every page (charset, viewport, og:site_name,
// twitter:card, favicons, fonts, a fallback title/description); everything
// page-specific — title, description, canonical, og:*, twitter:* — comes from
// `seo()` here so there is exactly one authoritative value per page.

export const SITE_URL = "https://threatlensapp.com";
export const SITE_NAME = "ThreatLens";
export const PUBLISHER_NAME = "ClickBox";
export const PUBLISHER_URL = "https://useclickbox.com";

/** Versioned filename so crawlers re-ingest instead of serving a cached card. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.png`;
export const DEFAULT_OG_IMAGE_ALT = "ThreatLens — SOC & cybersecurity investigation training";

type MetaEntry = Record<string, unknown>;

export interface SeoOptions {
  /**
   * Route path with a leading slash and no trailing slash (except the root "/").
   * Used verbatim for both the canonical URL and og:url.
   */
  path: string;
  title: string;
  description: string;
  /** Absolute URL or site-root-relative path. Defaults to the ThreatLens card. */
  image?: string;
  imageAlt?: string;
  /** Emit `noindex, nofollow` for this page. */
  noindex?: boolean;
  /** Extra JSON-LD blocks (already-built plain objects). */
  jsonLd?: Array<Record<string, unknown>>;
}

export interface SeoResult {
  meta: Array<MetaEntry>;
  links: Array<{ rel: string; href: string }>;
}

/** Build an absolute canonical URL from a route path. */
export function canonicalUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return `${SITE_URL}${p}`;
}

function absoluteImage(image?: string): string {
  if (!image) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(image)) return image;
  return `${SITE_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

/**
 * Returns `{ meta, links }` to spread into a route's `head()`:
 *
 *   head: () => {
 *     const s = seo({ path: "/platform", title: "...", description: "..." });
 *     return { meta: s.meta, links: s.links };
 *   }
 */
export function seo(options: SeoOptions): SeoResult {
  const url = canonicalUrl(options.path);
  const image = absoluteImage(options.image);
  const imageAlt = options.imageAlt ?? DEFAULT_OG_IMAGE_ALT;

  const meta: Array<MetaEntry> = [
    { title: options.title },
    { name: "description", content: options.description },
    { property: "og:title", content: options.title },
    { property: "og:description", content: options.description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:title", content: options.title },
    { name: "twitter:description", content: options.description },
    { name: "twitter:image", content: image },
  ];

  if (options.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  for (const block of options.jsonLd ?? []) {
    meta.push({ "script:ld+json": block });
  }

  return {
    meta,
    links: [{ rel: "canonical", href: url }],
  };
}

// ---- Structured data -------------------------------------------------------
// Accurate, verifiable facts only — no ratings, review counts, or user numbers.

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/brand-mark.png`,
    description:
      "ThreatLens is a SOC and cybersecurity investigation training platform: realistic incident investigations graded against a hidden ground truth.",
    parentOrganization: {
      "@type": "Organization",
      name: PUBLISHER_NAME,
      url: PUBLISHER_URL,
    },
    sameAs: [PUBLISHER_URL],
  };
}

export function webApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "SecurityApplication",
    applicationSubCategory: "Security investigation training",
    operatingSystem: "Web browser",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    description:
      "A browser-based cyber range for SOC analysts. Practice realistic identity, endpoint, email, and cloud investigations and get graded on technique accuracy, evidence recall and precision, and verdict against a hidden ground truth.",
    publisher: {
      "@type": "Organization",
      name: PUBLISHER_NAME,
      url: PUBLISHER_URL,
    },
  };
}
