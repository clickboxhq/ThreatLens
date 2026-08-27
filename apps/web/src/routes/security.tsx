import { createFileRoute } from "@tanstack/react-router";
import { Fingerprint, KeyRound, Lock, ScrollText, ShieldCheck, Timer } from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { SectionHead, displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({
    meta: [
      { title: "Security — ThreatLens" },
      {
        name: "description",
        content:
          "How ThreatLens is architected to handle authentication, authorization, tenant isolation, and data protection.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PRINCIPLES = [
  {
    icon: KeyRound,
    title: "Authentication",
    body: "Secure authentication for individuals and organizations, with support for password-based authentication and enterprise SSO where enabled. Sessions use short-lived access credentials and rotating refresh tokens, with sensitive authentication material protected from client-side storage.",
  },
  {
    icon: Fingerprint,
    title: "Role-based access control",
    body: "Access is governed by explicit roles and permissions — student, instructor, organization administrator, platform administrator. Capabilities are enforced centrally through shared authorization controls rather than scattered application-level checks.",
  },
  {
    icon: Lock,
    title: "Tenant isolation",
    body: "Organization data is logically isolated at the data-access layer. Tenant-scoped queries are required to include the appropriate organization boundary, reducing the risk of accidental cross-tenant access.",
  },
  {
    icon: ShieldCheck,
    title: "Ground-truth protection",
    body: "Scenario ground truth is protected from normal learner-facing APIs. Scoring infrastructure accesses answer keys through controlled internal paths, while learner-facing endpoints expose only the data required to conduct the investigation.",
  },
  {
    icon: Timer,
    title: "Rate limiting",
    body: "API rate limits protect authentication, investigation, evidence, and other sensitive endpoints against automated abuse and excessive request activity.",
  },
  {
    icon: ScrollText,
    title: "Audit logging",
    body: "Security-relevant and administrative actions are recorded through audit logging to provide traceability across the platform.",
  },
];

function SecurityPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
          style={monoFont}
        >
          Security
        </div>
        <h1
          className="mt-5 max-w-2xl text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[42px]"
          style={displayFont}
        >
          Security is built into the platform architecture.
        </h1>
        <p className="mt-4 max-w-xl text-[14.5px] leading-[1.7] text-white/55">
          ThreatLens, a product operated by ClickBox, is designed for security investigation
          training using synthetic telemetry rather than real customer security data. The platform
          architecture follows the same principles of isolation, access control, data protection,
          and operational security expected from modern enterprise software.
        </p>
        <p className="mt-3 max-w-xl text-[13px] leading-[1.7] text-white/40">
          This page describes the platform's security architecture and engineering practices. It is
          not a compliance certification or security certification.
        </p>
      </Section>

      <Section tone="light">
        <SectionHead
          tone="light"
          eyebrow="Principles"
          title="What the architecture is built around."
        />
        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="h-full glass-card-dark p-5">
              <div className="icon-frame-dark text-white/85">
                <p.icon className="size-[18px]" />
              </div>
              <h3 className="mt-3.5 text-[14px] font-semibold text-white" style={displayFont}>
                {p.title}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-white/55">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <p className="max-w-2xl text-[13.5px] leading-[1.8] text-white/55">
          Secrets are kept outside the source repository and rotated when exposure is suspected.
          Data in transit is protected using TLS, while sensitive configuration data receives
          additional protection at rest. Requests are validated at application boundaries, and
          dependencies are continuously monitored for known security vulnerabilities.
        </p>
        <p className="mt-4 max-w-2xl text-[13.5px] leading-[1.8] text-white/40">
          Have a security question? Contact us at{" "}
          <a href="mailto:info@useclickbox.com" className="text-white underline underline-offset-2">
            info@useclickbox.com
          </a>
          .
        </p>
      </Section>
    </MarketingPage>
  );
}
