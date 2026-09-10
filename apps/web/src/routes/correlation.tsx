import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { CorrelationEngine } from "@/components/soc/marketing/demos";
import { MobileDemoCrop } from "@/components/soc/marketing/chrome";
import { Correlation } from "@/components/soc/marketing/narrative";
import { Reveal, SectionHead, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/correlation")({
  component: CorrelationPage,
  head: () => {
    const s = seo({
      path: "/correlation",
      title: "Correlation — ThreatLens",
      description:
        "Correlate identity, endpoint, email, and cloud signals into a defensible incident narrative. Practice reading the evidence graph in ThreatLens.",
    });
    return { meta: s.meta, links: s.links };
  },
});

function CorrelationPage() {
  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28 text-center">
        <Reveal>
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
            style={monoFont}
          >
            Reading the graph
          </div>
        </Reveal>
        <Reveal delay={70}>
          <h1
            className="mx-auto mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white md:text-[46px]"
            style={displayFont}
          >
            Connect the signals. Reveal the attack path.
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-white/55">
            Individual events rarely tell the whole story. Correlate activity across identities,
            endpoints, email, cloud, and network telemetry to uncover how an incident developed.
          </p>
        </Reveal>
      </Section>

      <Section tone="dark">
        <Correlation />
      </Section>

      <Section tone="dark">
        <SectionHead
          eyebrow="Correlation practice"
          title="Find the connection others might miss."
          sub="Identity, endpoint, email, cloud, and network events remain independent until you establish the relationship between them. Learn to move beyond individual alerts and identify the sequence, dependencies, and relationships that reveal an incident."
        />
        <Reveal className="mt-14">
          <MobileDemoCrop>
            <CorrelationEngine />
          </MobileDemoCrop>
        </Reveal>
      </Section>

      <Section tone="light" className="text-center">
        <h2
          className="text-[26px] font-semibold tracking-[-0.02em] text-[#0A0C0F] md:text-[34px]"
          style={displayFont}
        >
          See how a full case comes together.
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/investigations" className="btn-primary w-full sm:w-auto">
            The investigation workflow <ArrowRight className="size-4" />
          </Link>
          <Link to="/signup" className="btn-ghost-light w-full sm:w-auto">
            Get started — free
          </Link>
        </div>
      </Section>
    </MarketingPage>
  );
}
