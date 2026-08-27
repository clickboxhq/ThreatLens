import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [{ title: "Terms of Service — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const SECTIONS = [
  {
    h: "About ThreatLens",
    b: 'ThreatLens is a product operated by ClickBox ("ClickBox," "we," "us," "our"). By creating an account or otherwise using ThreatLens, you\'re entering into this agreement with ClickBox as the operating company.',
  },
  {
    h: "Using ThreatLens",
    b: "ThreatLens is a training platform: a simulated environment for practicing SOC investigation skills against synthetic, generated telemetry. It is not a security monitoring product and should not be used to investigate real, live incidents.",
  },
  {
    h: "Your account",
    b: "You're responsible for the activity on your account and for keeping your credentials secure. Organization administrators are responsible for the accounts of the members they invite.",
  },
  {
    h: "Acceptable use",
    b: "Don't attempt to access another user's account or data, don't attempt to extract or reverse-engineer scenario ground truth outside of normal investigation, and don't use the platform to build a competing product.",
  },
  {
    h: "Service availability",
    b: "We aim for high availability but don't guarantee the service will be uninterrupted or error-free. Scheduled maintenance will be communicated in advance where practical.",
  },
  {
    h: "Intellectual property",
    b: "Scenarios, telemetry generation, scoring logic, and platform content belong to ClickBox. Your own case notes and submissions remain yours; we use them only to operate and improve the platform.",
  },
  {
    h: "Termination",
    b: "You can close your account at any time. We may suspend accounts that violate acceptable use, with notice where practical.",
  },
];

function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-[12.5px] text-white/40" style={monoFont}>
          Last updated: August 2026
        </p>
      </Section>

      <Section tone="light">
        <div className="max-w-3xl space-y-9">
          {SECTIONS.map((s) => (
            <div key={s.h} id={s.h === "Acceptable use" ? "acceptable-use" : undefined}>
              <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
                {s.h}
              </h2>
              <p className="mt-2 text-[14px] leading-[1.75] text-black/60">{s.b}</p>
            </div>
          ))}
          <div>
            <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
              Contact
            </h2>
            <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
              Questions about these terms — reach us at{" "}
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
