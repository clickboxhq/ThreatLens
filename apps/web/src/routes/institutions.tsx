import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileText,
  GraduationCap,
  Landmark,
  Radar,
  Rocket,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { Reveal, SectionHead, displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/institutions")({
  component: InstitutionsPage,
  head: () => ({
    meta: [
      { title: "For Organizations — ThreatLens" },
      {
        name: "description",
        content:
          "Universities, bootcamps, enterprises, government agencies, MSSPs, and workforce development programs — cohort-based SOC investigation training.",
      },
    ],
  }),
});

const SEGMENTS = [
  {
    icon: GraduationCap,
    t: "Universities & bootcamps",
    b: "Cybersecurity programs that need hands-on labs, not another slide deck.",
  },
  {
    icon: Building2,
    t: "Enterprises",
    b: "Onboarding new hires or leveling up junior analysts, at their own pace.",
  },
  {
    icon: Landmark,
    t: "Government agencies",
    b: "Workforce-ready SOC training without standing up a live range.",
  },
  {
    icon: TrendingUp,
    t: "Workforce development programs",
    b: "Measurable outcomes for public and nonprofit training initiatives.",
  },
  {
    icon: Radar,
    t: "Training providers & MSSPs",
    b: "A lab component you don't have to build or maintain yourselves.",
  },
  {
    icon: Rocket,
    t: "Accelerators & incubators",
    b: "Practical security training as part of a founder or cohort curriculum.",
  },
];

const FEATURES = [
  {
    icon: Users,
    name: "Cohorts & rosters",
    body: "Group learners, assign scenario sets, track deadlines.",
  },
  {
    icon: Wrench,
    name: "Instructor tools",
    body: "Grading overrides, reopen-with-feedback, scenario builder.",
  },
  {
    icon: BarChart3,
    name: "Training analytics",
    body: "Cohort comparison, technique mastery heatmaps, MTTR-equivalent.",
  },
  {
    icon: FileText,
    name: "Reporting & certificates",
    body: "Exportable reports per learner and per cohort, verifiable certificates.",
  },
];

function InstitutionsPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28 text-center">
        <Reveal>
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
            style={monoFont}
          >
            For organizations
          </div>
        </Reveal>
        <Reveal delay={70}>
          <h1
            className="mx-auto mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[46px]"
            style={displayFont}
          >
            Deploy practical security training without building the environment yourself.
          </h1>
        </Reveal>
        <Reveal delay={130}>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.6] text-white/55">
            Give analysts, students, and security teams a structured environment for hands-on
            investigation practice — with cohort management, instructor controls, assessment,
            reporting, and measurable progress built in.
          </p>
        </Reveal>
        <Reveal delay={190}>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/contact" className="btn-primary w-full sm:w-auto">
              Let's Talk <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </Section>

      <Section tone="light">
        <SectionHead
          tone="light"
          eyebrow="Who this is for"
          title="Every kind of training program."
        />
        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SEGMENTS.map((s) => (
            <div key={s.t} className="glass-card-dark p-6">
              <div className="icon-frame-dark text-white/85">
                <s.icon className="size-[18px]" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-white" style={displayFont}>
                {s.t}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-white/55">{s.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <SectionHead eyebrow="What you get" title="Everything a program needs to run at scale." />
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

      <Section tone="light" className="text-center">
        <h2
          className="text-[26px] font-semibold tracking-[-0.02em] text-[#0A0C0F] md:text-[34px]"
          style={displayFont}
        >
          Running the cohort yourself?
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/instructors" className="btn-primary w-full sm:w-auto">
            For instructors <ArrowRight className="size-4" />
          </Link>
          <Link to="/contact" className="btn-ghost-light w-full sm:w-auto">
            Let's Talk
          </Link>
        </div>
      </Section>
    </MarketingPage>
  );
}
