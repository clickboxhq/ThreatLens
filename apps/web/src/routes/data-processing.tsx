import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/data-processing")({
  component: DataProcessingPage,
  head: () => ({
    meta: [{ title: "Data Processing — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const SECTIONS = [
  {
    h: "Roles",
    b: "For organization accounts, ClickBox acts as the data processor for roster and progress data an organization administrator submits or manages on behalf of its members, who remain the data controller for that data. For individual accounts, ClickBox is the controller of the account data you provide directly.",
  },
  {
    h: "What gets processed",
    b: "Account and roster information, usage and scenario-progress data, and case notes or submissions made while using the platform. Investigation scenarios themselves run on synthetic, generated telemetry — never real third-party security data.",
  },
  {
    h: "Subprocessors",
    b: "We use a small number of infrastructure providers to host the application, deliver typefaces, and operate core services. We don't sell processed data to third parties or use it to train models outside of operating and improving ThreatLens.",
  },
  {
    h: "Data location and transfers",
    b: "Data is processed and stored on infrastructure operated by our hosting providers. Where data crosses borders, we rely on our providers' standard contractual safeguards.",
  },
  {
    h: "Security measures",
    b: "See our Security page for the technical and organizational measures applied across the platform, including access control, tenant isolation, and audit logging.",
  },
  {
    h: "Data deletion",
    b: "Organization administrators can request deletion of their organization's data at any time. Individual users can request deletion of their own account data via the contact below.",
  },
];

function DataProcessingPage() {
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
          Data Processing
        </h1>
        <p className="mt-2 text-[12.5px] text-white/40" style={monoFont}>
          Last updated: August 2026
        </p>
      </Section>

      <Section tone="light">
        <div className="max-w-3xl space-y-9">
          <div>
            <h2 className="text-[16px] font-semibold text-[#0A0C0F]" style={displayFont}>
              Overview
            </h2>
            <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
              This page describes how ClickBox, the company operating ThreatLens, processes data on
              behalf of organizations and individuals using the platform. It supplements our{" "}
              <Link to="/privacy" className="text-[#0A0C0F] underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
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
              Contact
            </h2>
            <p className="mt-2 text-[14px] leading-[1.75] text-black/60">
              Questions about data processing, or organizations that need a signed Data Processing
              Agreement — reach us at{" "}
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
