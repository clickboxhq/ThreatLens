import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [{ title: "Privacy Policy — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const SECTIONS = [
  {
    h: "About this policy",
    b: 'ThreatLens is a product operated by ClickBox ("ClickBox," "we," "us," "our"). This policy explains how ClickBox collects, uses, and protects data through the ThreatLens platform.',
  },
  {
    h: "What we collect",
    b: "Account information you provide (name, email, organization name if applicable), usage data (pages visited, features used, scenario progress), and cookies as described below. Investigation scenarios use synthetic, generated telemetry — never real third-party security data.",
  },
  {
    h: "How we use it",
    b: "To operate your account, track your progress and scoring, communicate service updates, and understand how the product is used so we can improve it. We do not sell personal data.",
  },
  {
    h: "Cookies",
    b: "Essential cookies keep you signed in and remember your preferences. Optional analytics and marketing cookies are only set with your consent, managed via the cookie banner on every page.",
  },
  {
    h: "Data retention",
    b: "Account and progress data is retained for as long as your account is active. You can request deletion at any time via the contact below.",
  },
  {
    h: "Your rights",
    b: "You can request access to, correction of, or deletion of your personal data at any time. For organization accounts, the organization administrator manages roster-level data on behalf of its members.",
  },
  {
    h: "Changes to this policy",
    b: "We'll update the date below if this policy changes materially, and post the update here.",
  },
];

function PrivacyPage() {
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
          Privacy Policy
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
              <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
                {s.b}
                {s.h === "Cookies" && (
                  <>
                    {" "}
                    See our{" "}
                    <Link to="/cookies" className="text-[#0A0C0F] underline underline-offset-2">
                      Cookie Policy
                    </Link>{" "}
                    for the full list of cookies we use.
                  </>
                )}
              </p>
            </div>
          ))}
          <div>
            <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
              Contact
            </h2>
            <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
              Questions about this policy — reach us at{" "}
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
