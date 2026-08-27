import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { Understanding, Response } from "@/components/soc/marketing/narrative";
import { Reveal, displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/scoring")({
  component: ScoringPage,
  head: () => ({
    meta: [
      { title: "Scoring — ThreatLens" },
      {
        name: "description",
        content:
          "How ThreatLens grades an investigation: technique accuracy, evidence recall and precision, required response actions, and verdict — against a hidden ground truth.",
      },
    ],
  }),
});

const SCORE_WEIGHTS: [string, string][] = [
  ["Technique accuracy", "30%"],
  ["Evidence recall", "25%"],
  ["Evidence precision", "15%"],
  ["Required response actions", "15%"],
  ["Correct verdict", "15%"],
];

function ScoringPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Reveal>
              <div
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
                style={monoFont}
              >
                Scoring
              </div>
            </Reveal>
            <Reveal delay={70}>
              <h1
                className="mt-5 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[46px]"
                style={displayFont}
              >
                Graded on the investigation, not just the answer.
              </h1>
            </Reveal>
            <Reveal delay={130}>
              <p className="mt-4 max-w-md text-[14.5px] leading-[1.7] text-white/55">
                Every case is scored against a hidden ground truth the moment you submit — a rubric,
                not a single pass/fail check. Guess the right verdict without the evidence to back
                it up, and it shows. Miss a required response action, and it shows.
              </p>
            </Reveal>
          </div>
          <Reveal delay={100}>
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6">
              <div
                className="text-[10px] uppercase tracking-[0.2em] text-white/35"
                style={monoFont}
              >
                Scoring rubric
              </div>
              <dl className="mt-4 divide-y divide-white/8">
                {SCORE_WEIGHTS.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2.5 text-[13px]">
                    <dt className="text-white/70">{k}</dt>
                    <dd className="font-medium text-white" style={monoFont}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11.5px] text-white/35">
                Minus a hint penalty (up to 15%) for hints used along the way.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="dark">
        <Understanding />
      </Section>

      <Section tone="dark">
        <Response />
      </Section>

      <Section tone="light" className="text-center">
        <h2
          className="text-[26px] font-semibold tracking-[-0.02em] text-[#0A0C0F] md:text-[34px]"
          style={displayFont}
        >
          Ready to see your own breakdown?
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="btn-primary w-full sm:w-auto">
            Get started — free <ArrowRight className="size-4" />
          </Link>
          <Link to="/investigations" className="btn-ghost-light w-full sm:w-auto">
            The investigation workflow
          </Link>
        </div>
      </Section>
    </MarketingPage>
  );
}
