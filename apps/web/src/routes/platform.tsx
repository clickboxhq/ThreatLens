import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  FileText,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  Lock,
  Radar,
  ScrollText,
} from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { CapabilityStack } from "@/components/soc/capability-stack";
import { Signal } from "@/components/soc/marketing/narrative";
import { Reveal, SectionHead, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/platform")({
  component: PlatformPage,
  head: () => {
    const s = seo({
      path: "/platform",
      title: "Platform — ThreatLens",
      description:
        "Everything a SOC analyst needs to practice, in one console — scenario engine, investigation portals, MITRE mapping, scoring, learning paths, and instructor tools.",
    });
    return { meta: s.meta, links: s.links };
  },
});

const MODULES = [
  {
    icon: LayoutDashboard,
    name: "SOC Console",
    body: "The unified investigation workspace — Sentinel/Chronicle-familiar.",
  },
  {
    icon: Radar,
    name: "Scenario Engine",
    body: "A realistic incident, generated fresh, every session.",
  },
  {
    icon: Fingerprint,
    name: "Identity, Endpoint & Email Portals",
    body: "Entra-, Defender-, and Outlook-style investigation surfaces.",
  },
  {
    icon: KeyRound,
    name: "Threat Intelligence",
    body: "Indicators, actors, and campaigns — with deliberate decoys.",
  },
  {
    icon: ClipboardList,
    name: "Case Management",
    body: "Evidence, timeline, notes, and verdict — one workspace.",
  },
  {
    icon: ScrollText,
    name: "MITRE ATT&CK Mapping",
    body: "Every technique tagged, every session scored against it.",
  },
  {
    icon: BarChart3,
    name: "Scoring & Feedback",
    body: "Graded on your evidence and reasoning, not just your answer.",
  },
  {
    icon: FileText,
    name: "Learning Paths & Certificates",
    body: "Structured tracks from first alert to job-ready.",
  },
  {
    icon: Lock,
    name: "Instructor Tools",
    body: "Cohorts, rosters, grading overrides, progress at a glance.",
  },
];

function PlatformPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28 text-center">
        <Reveal>
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
            style={monoFont}
          >
            Platform
          </div>
        </Reveal>
        <Reveal delay={70}>
          <h1
            className="mx-auto mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[46px]"
            style={displayFont}
          >
            A complete environment for security investigation practice.
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-white/55">
            Investigate across identity, endpoint, email, cloud, and network telemetry in one
            structured environment — from the first alert to the final verdict.
          </p>
        </Reveal>
      </Section>

      <Section tone="dark">
        <Signal />
      </Section>

      <Section tone="light">
        <SectionHead tone="light" eyebrow="Modules" title="One console, every domain." />
        <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <div key={m.name} className="glass-card-dark p-6">
              <div className="icon-frame-dark text-white/85">
                <m.icon className="size-[18px]" />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-white" style={displayFont}>
                {m.name}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-white/55">{m.body}</p>
              <span
                className="mt-4 block text-[10px] tracking-[0.22em] text-white/25"
                style={monoFont}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <CapabilityStack />
      </Section>
    </MarketingPage>
  );
}
