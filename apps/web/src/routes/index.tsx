import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  FileSearch,
  Gavel,
  GraduationCap,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Library,
  Linkedin,
  Menu,
  NotebookPen,
  Presentation,
  Radar,
  Rocket,
  ScrollText,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import {
  CommandCenter,
  InvestigationWorkspace,
  ExecutiveDashboard,
  ProofStrip,
} from "@/components/soc/marketing/demos";
import { DemoSection, DemoIntro, MobileDemoCrop } from "@/components/soc/marketing/chrome";
import { Pathways, Schematic } from "@/components/soc/marketing/art";
import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/soc/marketing/cookie-consent";
import { CountUp } from "@/components/soc/ui/count-up";
import { useAuthUser } from "@/lib/auth-store";
import {
  Bloom,
  GridField,
  Reveal,
  SectionHead,
  displayFont,
  monoFont,
} from "@/components/soc/marketing/atmos";

/** Brand-accurate marks lucide doesn't carry (or carries outdated). */
function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  );
}

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  );
}

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      {
        title: "ThreatLens — Security Investigation & Analyst Development Platform",
      },
      {
        name: "description",
        content:
          "ThreatLens simulates realistic SOC investigations across identity, endpoint, email, and cloud — and grades your investigation against a hidden ground truth. Not a SIEM. A cyber range for analysts.",
      },
    ],
  }),
});

/* ------------------------------- NAV ------------------------------- */

const NAV_LINKS: [string, string][] = [
  ["Platform", "/platform"],
  ["Investigations", "/investigations"],
  ["Who it's for", "#solutions"],
  ["Pricing", "#pricing"],
];

export function Nav() {
  const user = useAuthUser();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Close the mobile menu on route change / resize past the mobile breakpoint.
  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [menuOpen]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled || menuOpen ? "rgba(6,9,13,0.92)" : "transparent",
        borderBottom:
          scrolled || menuOpen ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
        backdropFilter: scrolled || menuOpen ? "blur(18px) saturate(140%)" : "none",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link
          to="/"
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex items-center gap-2.5"
          style={displayFont}
        >
          <Mark />
          <BrandLockup />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(([l, h]) => {
            const cls =
              "rounded-md px-3 py-1.5 text-[13px] text-white/60 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white";
            if (h.startsWith("/")) {
              return (
                <Link key={l} to={h} className={cls}>
                  {l}
                </Link>
              );
            }
            return (
              <Link key={l} to="/" hash={h.slice(1)} className={cls}>
                {l}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-1.5 md:flex">
          {user ? (
            <Link to="/app" className="btn-primary text-[13px]">
              <LayoutDashboard className="size-3.5" /> Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="rounded-md px-3 py-1.5 text-[13px] text-white/60 transition-colors hover:text-white"
              >
                Get Started
              </Link>
              <Link to="/login" className="btn-primary text-[13px]">
                Login <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/80 transition-colors hover:text-white"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/8 px-6 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col">
            {NAV_LINKS.map(([l, h]) => {
              const cls =
                "rounded-md px-2 py-3 text-[15px] text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white";
              if (h.startsWith("/")) {
                return (
                  <Link key={l} to={h} onClick={() => setMenuOpen(false)} className={cls}>
                    {l}
                  </Link>
                );
              }
              return (
                <Link
                  key={l}
                  to="/"
                  hash={h.slice(1)}
                  onClick={() => setMenuOpen(false)}
                  className={cls}
                >
                  {l}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-white/8 pt-4">
            {user ? (
              <Link
                to="/app"
                onClick={() => setMenuOpen(false)}
                className="btn-primary w-full justify-center"
              >
                <LayoutDashboard className="size-3.5" /> Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary w-full justify-center"
                >
                  Login <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="btn-ghost w-full justify-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ------------------------------- HERO ------------------------------- */

/** Atmospheric security graph + schematic plate behind the headline. */
function HeroArtwork() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/hero-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center 65%",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, #000 0%, rgba(0,0,0,0.9) 18%, rgba(0,0,0,0.55) 36%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.1) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-24"
        style={{ background: "linear-gradient(180deg, #000, transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background: "linear-gradient(180deg, transparent, #000)",
        }}
      />
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative z-0 overflow-hidden px-5 pb-16 pt-28 sm:px-8 md:pb-24 md:pt-36"
      style={{ background: "#000000", color: "#EDEDED" }}
    >
      <HeroArtwork />
      <div className="mx-auto max-w-[1440px]">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-6">
          <div>
            <Reveal>
              <h1
                className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[30px] md:text-[34px]"
                style={displayFont}
              >
                Real incidents. Real investigation. Real skills.
              </h1>
            </Reveal>

            <Reveal delay={110}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/signup" className="btn-primary">
                  Start investigating <ArrowRight className="size-3.5" />
                </Link>
                <a href="mailto:info@useclickbox.com" className="btn-ghost">
                  For institutions &amp; teams
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="relative lg:-mr-6 xl:-mr-24 2xl:-mr-40">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-16 -inset-y-14 -z-10"
                style={{
                  background:
                    "radial-gradient(900px 380px at 50% 20%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%)",
                }}
              />
              <div className="rounded-2xl shadow-[0_60px_140px_-40px_rgba(0,0,0,0.85)]">
                <MobileDemoCrop bleed>
                  <CommandCenter />
                </MobileDemoCrop>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={280} className="mt-14 md:mt-20">
          <ProofStrip />
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------- PIPELINE STRIP -------------------------- */

const STEPS = [
  {
    n: "01",
    icon: FileSearch,
    title: "Evidence Review",
    body: "Examine activity across identity, endpoint, email, cloud, and network telemetry. Determine which signals matter and preserve the evidence that supports your investigation.",
  },
  {
    n: "02",
    icon: Lightbulb,
    title: "Hypothesis",
    body: "Develop a working explanation of what happened, then challenge it against the available evidence. Deliberate decoys help test whether your reasoning holds up.",
  },
  {
    n: "03",
    icon: NotebookPen,
    title: "Investigation Notes",
    body: "Record your observations, assumptions, questions, and conclusions as the investigation develops. Your reasoning becomes part of the assessment.",
  },
  {
    n: "04",
    icon: ScrollText,
    title: "Timeline",
    body: "Organize relevant events into a coherent timeline and identify the sequence that connects the individual signals into an incident.",
  },
  {
    n: "05",
    icon: Gavel,
    title: "Findings & Verdict",
    body: "Classify the incident and explain your conclusion. Select the response actions you would take based on the evidence and observed impact.",
  },
  {
    n: "06",
    icon: BarChart3,
    title: "Scoring",
    body: "Your investigation is evaluated against the scenario's hidden ground truth, including evidence selection, reasoning, findings, and response decisions.",
  },
];

function LearningJourney() {
  return (
    <section style={{ background: "#FFFFFF", color: "#0A0C0F" }}>
      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <SectionHead
          tone="light"
          eyebrow="How it works"
          title="From first signal to final verdict."
          sub="Six stages. Every one of them yours to work through."
        />
        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 60}>
              <div className="relative">
                <div className="flex size-11 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03]">
                  <s.icon className="size-[18px] text-black/70" />
                </div>
                <div className="mt-4 text-[10.5px] tracking-[0.2em] text-black/35" style={monoFont}>
                  {s.n}
                </div>
                <div
                  className="mt-1.5 text-[15px] font-semibold text-[#0A0C0F]"
                  style={displayFont}
                >
                  {s.title}
                </div>
                <div className="mt-1.5 max-w-sm text-[13px] leading-[1.65] text-black/55">
                  {s.body}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- CUSTOMERS ---------------------------- */

const INDIVIDUAL_SEGMENTS = [
  {
    icon: GraduationCap,
    t: "Students & career switchers",
    b: "Portfolio-ready case work for people breaking into their first SOC role.",
  },
  {
    icon: ShieldCheck,
    t: "SOC analysts",
    b: "Building the investigation reps a certification alone can't teach.",
  },
  {
    icon: Library,
    t: "Cybersecurity learners",
    b: "Structured practice, not another course you'll forget by next month.",
  },
  {
    icon: Users,
    t: "Independent professionals",
    b: "Staying sharp between jobs, or preparing for an interview loop.",
  },
];

const ORG_SEGMENTS = [
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

type Segment = { icon: typeof GraduationCap; t: string; b: string };

function SegmentGrid({ label, items }: { label: string; items: Segment[] }) {
  return (
    <div className="mt-10 first:mt-0">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-black/40" style={monoFont}>
        {label}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <div key={s.t} className="glass-card-dark card-hover-lift h-full p-6">
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
    </div>
  );
}

function CustomerTypes() {
  return (
    <section id="solutions" style={{ background: "#FFFFFF", color: "#0A0C0F" }}>
      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <SectionHead
          tone="light"
          eyebrow="Who it's for"
          title="Built for individuals and organizations."
          sub="A practical environment to build skills. Infrastructure to train talent at scale."
        />
        <SegmentGrid label="For individuals" items={INDIVIDUAL_SEGMENTS} />
        <SegmentGrid label="For organizations" items={ORG_SEGMENTS} />
      </div>
    </section>
  );
}

/* ------------------------------- TRUST ------------------------------- */

const TRUST_STATS: {
  icon: typeof Library;
  target: number | null;
  suffix?: string;
  staticValue?: string;
  label: string;
}[] = [
  { icon: Library, target: 50, suffix: "+", label: "Investigation scenarios" },
  { icon: Boxes, target: 4, label: "Security domains covered" },
  { icon: Tags, target: 12, label: "MITRE ATT&CK techniques mapped" },
  { icon: GraduationCap, target: 2, label: "Structured learning tracks" },
  { icon: Users, target: null, staticValue: "Cohorts", label: "Organization support" },
];

/** Fires `seen` once an element scrolls into view — drives the counters below. */
function useOnScreenOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

function Trust() {
  const { ref, seen } = useOnScreenOnce<HTMLDivElement>();
  return (
    <section style={{ background: "#000000", color: "#EDEDED" }}>
      <div ref={ref} className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TRUST_STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 50}>
              <div className="glass-card-dark card-hover-lift h-full p-5">
                <div className="icon-frame-dark text-white/85">
                  <s.icon className="size-[18px]" />
                </div>
                <div
                  className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-white"
                  style={displayFont}
                >
                  {s.target === null ? (
                    s.staticValue
                  ) : (
                    <>
                      <CountUp value={seen ? s.target : 0} />
                      {s.suffix}
                    </>
                  )}
                </div>
                <div className="mt-1 text-[12px] leading-[1.4] text-white/50">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- PRODUCT ECOSYSTEM ------------------------- */

const ECOSYSTEM = [
  { icon: LayoutDashboard, name: "SOC Console", body: "The unified investigation workspace." },
  {
    icon: Layers,
    name: "Investigation Workspace",
    body: "Evidence, timeline, and notes — one place.",
  },
  { icon: Radar, name: "Scenario Engine", body: "A fresh, realistic incident every session." },
  {
    icon: KeyRound,
    name: "Threat Intelligence",
    body: "Indicators, actors, campaigns — with decoys.",
  },
  { icon: BarChart3, name: "Scoring Engine", body: "Graded against a hidden ground truth." },
  { icon: Presentation, name: "Instructor Tools", body: "Rosters, grading, scenario assignment." },
  {
    icon: TrendingUp,
    name: "Progress Tracking",
    body: "Score trend and technique mastery over time.",
  },
  { icon: Award, name: "Certificates", body: "Verifiable proof of completion." },
  {
    icon: Building2,
    name: "Organization Management",
    body: "Cohorts, seats, and reporting for teams.",
  },
];

function ProductEcosystem() {
  return (
    <section id="platform" style={{ background: "#FFFFFF", color: "#0A0C0F" }}>
      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <SectionHead tone="light" eyebrow="Platform" title="One ecosystem. Every capability." />
        <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ECOSYSTEM.map((m, i) => (
            <Reveal key={m.name} delay={(i % 3) * 60}>
              <div className="glass-card-dark card-hover-lift h-full p-6">
                <div className="icon-frame-dark text-white/85">
                  <m.icon className="size-[18px]" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-white" style={displayFont}>
                  {m.name}
                </h3>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-white/55">{m.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- PRICING ----------------------------- */

const INDIVIDUAL_FEATURES = [
  "Unlimited investigation scenarios",
  "Identity, endpoint, email & cloud investigation",
  "MITRE ATT&CK mapping",
  "Evidence-based scoring",
  "Investigation notes & timeline building",
  "Progress dashboard & investigation history",
  "Learning paths & certificates",
];

const ORG_FEATURES = [
  "Multiple learner accounts",
  "Cohort management & instructor dashboard",
  "Assign investigations & monitor progress",
  "Performance analytics & investigation scoring",
  "Custom scenario packs",
  "Reporting & instructor feedback",
  "Organization workspace & support",
];

const ENTERPRISE_FEATURES = [
  "SSO & advanced RBAC",
  "Large-scale user management",
  "Custom scenario & learning-path development",
  "Advanced analytics",
  "LMS & gradebook integration",
  "Dedicated support & custom deployment",
];

function PricingCard({
  name,
  badge,
  price,
  priceNote,
  body,
  features,
  cta,
  ctaHref,
  featured,
  delay,
}: {
  name: string;
  badge?: string;
  price: string;
  priceNote?: string;
  body: string;
  features: string[];
  cta: string;
  ctaHref: string;
  featured?: boolean;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div
        className="glass-card-dark relative flex h-full flex-col overflow-hidden p-8"
        style={{
          borderColor: featured
            ? "color-mix(in oklab, var(--primary) 45%, transparent)"
            : undefined,
          background: featured
            ? "linear-gradient(180deg, color-mix(in oklab, var(--primary) 12%, transparent), transparent 55%), #0A0A0A"
            : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-semibold text-white" style={displayFont}>
            {name}
          </div>
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{
                background: "color-mix(in oklab, var(--primary) 18%, transparent)",
                color: "color-mix(in oklab, var(--primary) 92%, white)",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[24px] font-semibold text-white" style={displayFont}>
            {price}
          </span>
        </div>
        {priceNote && (
          <div className="mt-1 text-[12px] text-white/45" style={monoFont}>
            {priceNote}
          </div>
        )}
        <p className="mt-3 text-[13px] leading-[1.6] text-white/50">{body}</p>
        <ul className="mt-6 space-y-2.5 text-[13px]">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-white/75">
              <span
                className="mt-[7px] size-1.5 shrink-0 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              {f}
            </li>
          ))}
        </ul>
        <div className="flex-1" />
        {ctaHref.startsWith("/") ? (
          <Link
            to={ctaHref}
            className={
              featured
                ? "btn-primary mt-8 w-full justify-center"
                : "btn-ghost mt-8 w-full justify-center"
            }
          >
            {cta} <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <a
            href={ctaHref}
            className={
              featured
                ? "btn-primary mt-8 w-full justify-center"
                : "btn-ghost mt-8 w-full justify-center"
            }
          >
            {cta} <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>
    </Reveal>
  );
}

function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <section id="pricing" style={{ background: "#000000", color: "#EDEDED" }}>
      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <SectionHead
          eyebrow="Pricing"
          title="Practice the skill. Build the analyst."
          sub="Start with a 7-day trial and continue with a subscription built for continuous investigation practice. Teams and institutions get dedicated tools for managing learners, cohorts, and outcomes."
        />

        <Reveal delay={40}>
          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {(["monthly", "annual"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setBilling(period)}
                  className="rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition-colors"
                  style={{
                    background: billing === period ? "#fff" : "transparent",
                    color: billing === period ? "#0A0C0F" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {billing === "monthly" ? (
            <PricingCard
              name="Individual"
              price="$19/month"
              priceNote="7-day free trial"
              body="For individuals building real SOC investigation skill."
              features={INDIVIDUAL_FEATURES}
              cta="Start 7-Day Trial"
              ctaHref="/signup"
              delay={0}
            />
          ) : (
            <PricingCard
              name="Individual"
              price="$190/year"
              priceNote="Save ~17% · 7-day free trial"
              body="For individuals building real SOC investigation skill."
              features={INDIVIDUAL_FEATURES}
              cta="Start Annual Plan"
              ctaHref="/signup"
              delay={0}
            />
          )}
          <PricingCard
            name="Organizations & Institutions"
            badge="Most cohorts"
            featured
            price="Starting at $199/month"
            body="For teams, cohorts, universities, bootcamps and training programs."
            features={ORG_FEATURES}
            cta="Let's Talk"
            ctaHref="/contact"
            delay={80}
          />
          <PricingCard
            name="Enterprise"
            price="Custom"
            body="For organizations requiring scale, integrations, custom programs and enterprise support."
            features={ENTERPRISE_FEATURES}
            cta="Let's Talk"
            ctaHref="/contact"
            delay={160}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ FOOTER ------------------------------ */

const FOOTER_COLS = [
  {
    title: "Platform",
    links: [
      { l: "Investigations", h: "/investigations" },
      { l: "Correlation", h: "/correlation" },
      { l: "Scoring", h: "/scoring" },
    ],
  },
  {
    title: "Who it's for",
    links: [
      { l: "For individuals", h: "/students" },
      { l: "For organizations", h: "/institutions" },
      { l: "For instructors", h: "/instructors" },
    ],
  },
  {
    title: "Company",
    links: [
      { l: "Security", h: "/security" },
      { l: "Contact", h: "mailto:info@useclickbox.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { l: "Privacy", h: "/privacy" },
      { l: "Terms", h: "/terms" },
      { l: "Cookies", h: "/cookies" },
      { l: "Data Processing", h: "/data-processing" },
      { l: "Cookie Settings", h: "cookie-settings" },
      { l: "Acceptable use", h: "/terms#acceptable-use" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/8 bg-black">
      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <div
          className="relative overflow-hidden rounded-2xl border p-8 md:p-14"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            background: "#080808",
          }}
        >
          <GridField size={40} opacity={0.06} />
          <Bloom className="-left-20 -top-24 h-72 w-[36rem]" intensity={0.16} />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h3
                className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-[38px]"
                style={displayFont}
              >
                Ready to run your first case?
              </h3>
            </div>
            <div className="flex shrink-0 gap-3">
              <Link to="/signup" className="btn-primary">
                Get started <ArrowRight className="size-4" />
              </Link>
              <a href="mailto:info@useclickbox.com" className="btn-ghost">
                For institutions
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-black">
                <img
                  src="/clickbox-logo.png"
                  alt="ClickBox"
                  className="size-full object-contain p-1"
                />
              </span>
              <span className="text-[13px] font-semibold text-white/70" style={displayFont}>
                ClickBox
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Mark className="size-6" />
              <span className="text-white" style={displayFont}>
                <BrandLockup size="footer" />
              </span>
            </div>
            <p className="mt-4 text-[12.5px] leading-[1.65] text-white/40">
              ThreatLens is a security investigation and analyst development platform by ClickBox
              built to help individuals and organizations develop practical incident investigation
              capability through realistic, hands-on scenarios.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div
                className="text-[10px] uppercase tracking-[0.22em] text-white/35"
                style={monoFont}
              >
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((item) => {
                  const cls = "text-[13px] text-white/65 transition-colors hover:text-white";
                  if (item.h === "cookie-settings") {
                    return (
                      <li key={item.l}>
                        <button
                          type="button"
                          onClick={() =>
                            window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
                          }
                          className={cls}
                        >
                          {item.l}
                        </button>
                      </li>
                    );
                  }
                  if (item.h.includes("#") || !item.h.startsWith("/")) {
                    return (
                      <li key={item.l}>
                        <a href={item.h} className={cls}>
                          {item.l}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={item.l}>
                      <Link to={item.h} className={cls}>
                        {item.l}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-6 text-[11.5px] text-white/35">
          <div>© 2026 ThreatLens</div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/usethreatlens?igsi=MWp3dmNuZ2Vhcjg5ag=="
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ThreatLens on Instagram"
              className="transition-colors hover:text-white"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://x.com/usethreatlens?s=11"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ThreatLens on X"
              className="transition-colors hover:text-white"
            >
              <XIcon />
            </a>
            <a
              href="https://www.linkedin.com/company/threatlensapp/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ThreatLens on LinkedIn"
              className="transition-colors hover:text-white"
            >
              <Linkedin className="size-4" />
            </a>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-5 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-black">
              <img
                src="/clickbox-logo.png"
                alt="ClickBox"
                className="size-full object-contain p-0.5"
              />
            </span>
            <span>ThreatLens by ClickBox</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------- PRODUCT DEMOS -------------------------- */

/** The two demos kept on the homepage — Investigation Workspace and
 * Progress & Instructor Dashboard. Correlation Practice moved to its own
 * dedicated page (/correlation) to keep the homepage shorter. */
function HomeDemos() {
  return (
    <div id="product" className="relative" style={{ background: "#000000", color: "#EDEDED" }}>
      <DemoSection id="workspace">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <Pathways opacity={0.32} />
        </div>
        <DemoIntro
          index="01"
          kicker="Investigation Workspace"
          title="Investigate with the tools analysts actually use."
          body="Evidence, timeline, and case notes in one workspace."
        />
        <Reveal className="mt-14">
          <MobileDemoCrop>
            <InvestigationWorkspace />
          </MobileDemoCrop>
        </Reveal>
      </DemoSection>

      <DemoSection id="executive">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <Schematic opacity={0.22} />
        </div>
        <DemoIntro
          index="02"
          kicker="Progress & Instructor Dashboard"
          title="Numbers that actually track whether you're learning."
          body="Score trend and mastery — for you, or a whole cohort."
        />
        <Reveal className="mt-14">
          <MobileDemoCrop>
            <ExecutiveDashboard />
          </MobileDemoCrop>
        </Reveal>
      </DemoSection>
    </div>
  );
}

/* ------------------------------ PAGE ------------------------------ */

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Nav />
      <Hero />
      <Trust />
      <ProductEcosystem />
      <HomeDemos />
      <CustomerTypes />
      <LearningJourney />
      <Pricing />
      <Footer />
    </div>
  );
}
