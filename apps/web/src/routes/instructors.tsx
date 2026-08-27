import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardCheck, MessageSquare, Presentation, Users } from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { ExecutiveDashboard } from "@/components/soc/marketing/demos";
import { MobileDemoCrop } from "@/components/soc/marketing/chrome";
import { Reveal, SectionHead, displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/instructors")({
  component: InstructorsPage,
  head: () => ({
    meta: [
      { title: "For Instructors — ThreatLens" },
      {
        name: "description",
        content:
          "Rosters, grading overrides, scenario assignment, and cohort progress — the instructor side of ThreatLens.",
      },
    ],
  }),
});

const FEATURES = [
  {
    icon: Users,
    name: "Cohort roster",
    body: "Every learner's status, at a glance — who's stuck, who's ahead.",
  },
  {
    icon: Presentation,
    name: "Scenario assignment",
    body: "Assign scenario sets and deadlines per cohort or per learner.",
  },
  {
    icon: ClipboardCheck,
    name: "Grading overrides",
    body: "Reopen a case with feedback, override a score, keep a history of both.",
  },
  {
    icon: MessageSquare,
    name: "Feedback loop",
    body: "Leave notes on a submission the learner sees the moment they reopen it.",
  },
];

function InstructorsPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28 text-center">
        <Reveal>
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
            style={monoFont}
          >
            For instructors
          </div>
        </Reveal>
        <Reveal delay={70}>
          <h1
            className="mx-auto mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[46px]"
            style={displayFont}
          >
            Run a cohort without running a spreadsheet.
          </h1>
        </Reveal>
      </Section>

      <Section tone="light">
        <SectionHead
          tone="light"
          eyebrow="Instructor tools"
          title="Everything you need to run a course, built in."
        />
        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.name} delay={i * 60}>
              <div className="h-full glass-card-dark p-5">
                <div className="icon-frame-dark text-white/85">
                  <f.icon className="size-[18px]" />
                </div>
                <h3 className="mt-3.5 text-[14px] font-semibold text-white" style={displayFont}>
                  {f.name}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-white/55">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <SectionHead
          eyebrow="Progress & instructor dashboard"
          title="A whole cohort's progress, at a glance."
          sub="Score trend, technique mastery, and case history — for one learner, or a whole cohort."
        />
        <Reveal className="mt-14">
          <MobileDemoCrop>
            <ExecutiveDashboard />
          </MobileDemoCrop>
        </Reveal>
      </Section>

      <Section tone="dark" className="text-center">
        <h2
          className="text-[26px] font-semibold tracking-[-0.02em] text-white md:text-[34px]"
          style={displayFont}
        >
          Setting this up for your program?
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/contact" className="btn-primary w-full sm:w-auto">
            Let's Talk <ArrowRight className="size-4" />
          </Link>
          <Link to="/institutions" className="btn-ghost w-full sm:w-auto">
            For organizations
          </Link>
        </div>
      </Section>
    </MarketingPage>
  );
}
