/**
 * The ThreatLens investigation narrative: SIGNAL → CORRELATION → INVESTIGATION →
 * UNDERSTANDING → RESPONSE. One continuous story of what a learner actually
 * does in a case, not five feature cards; the artwork bleeds past the
 * containers and connects chapters.
 */
import {
  Bloom,
  EvidenceGraph,
  GridField,
  Reveal,
  SignalStreams,
  TopologyDiagram,
  displayFont,
  monoFont,
} from "./atmos";

function ChapterLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] tracking-[0.24em] text-white/35" style={monoFont}>
        {n}
      </span>
      <span
        className="text-[11px] uppercase tracking-[0.28em]"
        style={{
          ...monoFont,
          color: "color-mix(in oklab, var(--primary) 90%, white)",
        }}
      >
        {title}
      </span>
    </div>
  );
}

function ChapterCopy({
  n,
  label,
  heading,
  body,
  facts,
}: {
  n: string;
  label: string;
  heading: string;
  body: string;
  facts?: [string, string][];
}) {
  return (
    <Reveal className="max-w-lg">
      <ChapterLabel n={n} title={label} />
      <h3
        className="mt-5 text-[26px] font-semibold leading-[1.1] tracking-[-0.025em] text-white md:text-[34px]"
        style={displayFont}
      >
        {heading}
      </h3>
      <p className="mt-4 text-[14.5px] leading-[1.7] text-white/55 [text-wrap:pretty]">{body}</p>
      {facts && (
        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/8 pt-6">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt
                className="text-[9.5px] uppercase tracking-[0.22em] text-white/35"
                style={monoFont}
              >
                {k}
              </dt>
              <dd className="mt-1.5 text-[19px] font-semibold text-white" style={displayFont}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Reveal>
  );
}

/* ---------------------------------------------------------- chapters */

export function Signal() {
  return (
    <div className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <ChapterCopy
        n="01"
        label="Signal"
        heading="Every investigation begins with incomplete information."
        body="ThreatLens places you inside realistic security scenarios containing identity activity, endpoint telemetry, email signals, cloud audit trails, and network events. Each case uses synthetic data designed to reproduce the ambiguity and complexity of a real security investigation — without exposing real customer data."
        facts={[
          ["events / case", "80–300"],
          ["domains covered", "4"],
        ]}
      />
      <Reveal delay={120} className="relative h-[300px] md:h-[380px]">
        <SignalStreams className="opacity-90" />
        <Bloom className="inset-x-1/3 inset-y-1/4" intensity={0.1} />
      </Reveal>
    </div>
  );
}

export function Correlation() {
  return (
    <div className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <Reveal className="relative order-2 h-[340px] md:h-[440px] lg:order-1">
        <TopologyDiagram />
      </Reveal>
      <div className="order-1 lg:order-2 lg:justify-self-end">
        <ChapterCopy
          n="02"
          label="Correlation"
          heading="See the relationships behind the alerts."
          body="Security investigations depend on understanding relationships, not simply reading individual alerts. Connect identity activity, endpoint behavior, email events, cloud activity, and network signals across time to determine whether separate events belong to the same incident. The platform provides the evidence and relationships. The investigation is yours."
          facts={[
            ["signal domains", "4"],
            ["decoys seeded", "on purpose"],
          ]}
        />
      </div>
    </div>
  );
}

export function Investigation() {
  return (
    <div className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <ChapterCopy
        n="03"
        label="Investigation"
        heading="Pull the evidence. Test your reasoning."
        body="Pull the evidence, test your hypotheses, and discard what doesn't hold. The console provides the graph and the tools an analyst actually uses — the reasoning behind each conclusion is what gets assessed."
        facts={[
          ["evidence pinned / case", "your call"],
          ["hints", "cost points"],
        ]}
      />
      <Reveal delay={120} className="relative h-[320px] md:h-[400px]">
        <EvidenceGraph />
        <Bloom className="right-[8%] top-1/3 h-40 w-40" intensity={0.16} />
      </Reveal>
    </div>
  );
}

const STORY = [
  { t: "02:14", d: "SSH success · SRV-DB-07 · unrecognized ASN", tag: "T1078" },
  { t: "02:19", d: "3 privileged queries · customers.pii", tag: "T1213" },
  { t: "22:41", d: "OAuth consent granted · sarah.chen@contoso.com", tag: "T1528" },
  { t: "23:02", d: "Inbox rule created · forward-external", tag: "T1114" },
];

export function Understanding() {
  return (
    <div className="relative grid items-center gap-14 lg:grid-cols-2">
      <ChapterCopy
        n="04"
        label="Understanding"
        heading="Turn fragmented signals into a defensible incident narrative."
        body="Security incidents rarely arrive as a single clean alert. ThreatLens gives you the individual signals and asks you to determine how they connect. Correlate activity across users, hosts, identities, applications, and time — then build the incident narrative yourself. Map relevant activity to MITRE ATT&CK and explain why the evidence supports your conclusion."
      />
      <Reveal delay={120}>
        <div className="relative">
          <div
            aria-hidden
            className="absolute left-[7px] top-2 bottom-2 w-px"
            style={{
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--primary) 70%, transparent), transparent)",
            }}
          />
          <ol className="space-y-3.5 pl-8">
            {STORY.map((s, i) => (
              <li key={s.t} className="relative">
                <span
                  className="absolute -left-[26px] top-3 size-[7px] rounded-full"
                  style={{
                    background: "var(--primary)",
                    boxShadow: "0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent)",
                  }}
                />
                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/8 bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-white/20"
                  style={{ transitionDelay: `${i * 20}ms` }}
                >
                  <span className="text-[11.5px] text-white/40" style={monoFont}>
                    {s.t}
                  </span>
                  <span className="text-[13px] text-white/80">{s.d}</span>
                  <span
                    className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/55"
                    style={monoFont}
                  >
                    {s.tag}
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <div
            className="mt-5 rounded-lg border px-4 py-3 text-[13.5px] leading-[1.6] text-white/85"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 45%, transparent)",
              background: "color-mix(in oklab, var(--primary) 9%, transparent)",
            }}
          >
            <span
              className="mr-2 text-[10px] uppercase tracking-[0.2em]"
              style={{
                ...monoFont,
                color: "color-mix(in oklab, var(--primary) 92%, white)",
              }}
            >
              verdict
            </span>
            Consent-phish → token abuse → database exfiltration attempt. One actor, 21 hours,
            confirmed.
          </div>
        </div>
      </Reveal>
    </div>
  );
}

const ACTIONS = [
  ["Revoke OAuth token", "identity"],
  ["Quarantine SRV-DB-07", "endpoint"],
  ["Purge forwarding rule", "email"],
  ["Rotate DB credentials", "cloud"],
];

export function Response() {
  return (
    <div className="relative grid items-center gap-14 lg:grid-cols-2">
      <Reveal className="order-2 lg:order-1">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {ACTIONS.map(([a, d], i) => (
            <div
              key={a}
              className="group rounded-xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-white/25"
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <div
                className="text-[9.5px] uppercase tracking-[0.22em] text-white/35"
                style={monoFont}
              >
                {d}
              </div>
              <div className="mt-2 text-[14px] font-medium text-white" style={displayFont}>
                {a}
              </div>
              <div className="mt-3 h-px w-full bg-white/8">
                <div
                  className="h-px w-0 transition-[width] duration-700 group-hover:w-full"
                  style={{ background: "var(--primary)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <div className="order-1 lg:order-2 lg:justify-self-end">
        <ChapterCopy
          n="05"
          label="Response"
          heading="Reach a conclusion. Decide what happens next."
          body="Every investigation ends with an evidence-backed verdict and a response decision. Determine what happened, assess the impact, and select the actions you would take next. Your decisions are evaluated against the scenario's hidden ground truth and reflected in your investigation breakdown."
          facts={[
            ["verdict options", "TP · FP · benign"],
            ["scored on", "evidence + actions"],
          ]}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- shell */

export function Narrative() {
  return (
    <section id="how" className="relative">
      <GridField className="opacity-[0.06]" size={64} opacity={0.06} />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="border-b border-white/8 py-20 md:py-24">
          <Signal />
        </div>
        <div className="border-b border-white/8 py-20 md:py-24">
          <Correlation />
        </div>
        <div className="border-b border-white/8 py-20 md:py-24">
          <Investigation />
        </div>
        <div className="border-b border-white/8 py-20 md:py-24">
          <Understanding />
        </div>
        <div className="py-20 md:py-24">
          <Response />
        </div>
      </div>
    </section>
  );
}
