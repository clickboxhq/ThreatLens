import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Award, BarChart3, GraduationCap, Layers } from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { Reveal, SectionHead, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/students")({
  component: StudentsPage,
  head: () => {
    const s = seo({
      path: "/students",
      title: "For Individuals — ThreatLens",
      description:
        "Students, career switchers, SOC analysts, and independent professionals — build the investigation reps a certification alone can't teach.",
    });
    return { meta: s.meta, links: s.links };
  },
});

const SEGMENTS = [
  {
    t: "Students & career switchers",
    b: "Portfolio-ready case work for people breaking into their first SOC role.",
  },
  { t: "SOC analysts", b: "Building the investigation reps a certification alone can't teach." },
  {
    t: "Cybersecurity learners",
    b: "Structured practice, not another course you'll forget by next month.",
  },
  {
    t: "Independent professionals",
    b: "Staying sharp between jobs, or preparing for an interview loop.",
  },
];

const FEATURES = [
  {
    icon: Layers,
    name: "Unlimited investigations",
    body: "Every scenario, every session — no caps on how much you practice.",
  },
  {
    icon: BarChart3,
    name: "Personal progress dashboard",
    body: "Score trend and technique mastery, tracked case by case.",
  },
  {
    icon: GraduationCap,
    name: "Learning paths",
    body: "Structured tracks from first alert to job-ready, at your pace.",
  },
  {
    icon: Award,
    name: "Certificates",
    body: "Verifiable, shareable proof of completion — a real signal on a resume.",
  },
];

function StudentsPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28 text-center">
        <Reveal>
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
            style={monoFont}
          >
            For individuals
          </div>
        </Reveal>
        <Reveal delay={70}>
          <h1
            className="mx-auto mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[46px]"
            style={displayFont}
          >
            Build the reps a certification alone can't teach.
          </h1>
        </Reveal>
        <Reveal delay={130}>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.6] text-white/55">
            Free to start, no cohort required. Practice on your own schedule, get scored on your own
            cases.
          </p>
        </Reveal>
        <Reveal delay={190}>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup" className="btn-primary w-full sm:w-auto">
              Get started — free <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </Section>

      <Section tone="light">
        <SectionHead
          tone="light"
          eyebrow="Who this is for"
          title="Wherever you're starting from."
        />
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-black/8 bg-black/[0.04] md:grid-cols-2">
          {SEGMENTS.map((s) => (
            <div key={s.t} className="bg-white p-6">
              <h3 className="text-[15px] font-semibold text-[#0A0C0F]" style={displayFont}>
                {s.t}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-black/55">{s.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <SectionHead eyebrow="What you get" title="A personal track, not a shared one." />
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
          Coming with a cohort instead?
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/institutions" className="btn-primary w-full sm:w-auto">
            For organizations <ArrowRight className="size-4" />
          </Link>
          <Link to="/signup" className="btn-ghost-light w-full sm:w-auto">
            Get started — free
          </Link>
        </div>
      </Section>
    </MarketingPage>
  );
}
