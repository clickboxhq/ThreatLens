import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
  head: () => ({
    meta: [{ title: "Cookie Policy — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const CATEGORIES = [
  {
    h: "Essential",
    always: true,
    b: "Required to keep you signed in, remember your account type, and maintain basic site functionality. These can't be turned off, since the platform doesn't work without them.",
  },
  {
    h: "Analytics",
    always: false,
    b: "Help us understand which pages and features are actually used, so we can prioritize what to build and fix. Only set if you accept them via the cookie banner.",
  },
  {
    h: "Marketing",
    always: false,
    b: "Used to measure the effectiveness of our own outreach. ThreatLens does not sell cookie data to third parties. Only set if you accept them via the cookie banner.",
  },
];

const SECTIONS = [
  {
    h: "What cookies are",
    b: "Small text files a site stores in your browser to remember information between visits — like whether you're signed in, or which preferences you've already told us about.",
  },
  {
    h: "Third-party cookies",
    b: "Google Fonts and jsDelivr, used to load typefaces, may set minimal technical cookies of their own when those resources load. We don't control third-party cookie behavior directly, but neither service is used for tracking on this site.",
  },
  {
    h: "Managing your preferences",
    b: "You can accept all, reject non-essential, or choose specific categories from the cookie banner shown on your first visit. You can change your choice at any time by clearing your browser's cookies for this site, which will show the banner again.",
  },
];

function CookiesPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-16">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60"
          style={monoFont}
        >
          Legal
        </div>
        <h1
          className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-white md:text-[36px]"
          style={displayFont}
        >
          Cookie Policy
        </h1>
        <p className="mt-2 text-[12.5px] text-white/40" style={monoFont}>
          Last updated: August 2026
        </p>
      </Section>

      <Section tone="light">
        <div className="max-w-3xl space-y-9">
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
                {s.h}
              </h2>
              <p className="mt-2 text-[14px] leading-[1.75] text-black/60">{s.b}</p>
            </div>
          ))}

          <div>
            <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
              Categories we use
            </h2>
            <div className="mt-4 space-y-4">
              {CATEGORIES.map((c) => (
                <div key={c.h} className="rounded-xl border border-black/10 bg-black/[0.015] p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13.5px] font-semibold text-[#0A0C0F]">{c.h}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]"
                      style={{
                        ...monoFont,
                        color: c.always ? "#0A0C0F" : "rgba(10,12,15,0.55)",
                        background: c.always ? "rgba(10,12,15,0.08)" : "rgba(10,12,15,0.04)",
                      }}
                    >
                      {c.always ? "Always on" : "Optional"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-[1.7] text-black/55">{c.b}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
              Related
            </h2>
            <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
              See our{" "}
              <Link to="/privacy" className="text-[#0A0C0F] underline underline-offset-2">
                Privacy Policy
              </Link>{" "}
              for how ClickBox handles personal data more broadly.
            </p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
              Contact
            </h2>
            <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
              Questions about cookies — reach us at{" "}
              <a
                href="mailto:info@useclickbox.com"
                className="text-[#0A0C0F] underline underline-offset-2"
              >
                info@useclickbox.com
              </a>
              .
            </p>
          </div>
        </div>
      </Section>
    </MarketingPage>
  );
}
