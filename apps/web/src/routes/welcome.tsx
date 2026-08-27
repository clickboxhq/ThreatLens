import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  FileSearch,
  Gavel,
  Laptop,
  Lightbulb,
  NotebookPen,
  ScrollText,
} from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { Reveal, TopologyDiagram, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { useSoc } from "@/lib/store";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
  head: () => ({
    meta: [{ title: "Welcome — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const STEPS = [
  { icon: FileSearch, label: "Review the evidence" },
  { icon: Lightbulb, label: "Investigate the signals" },
  { icon: ScrollText, label: "Build the timeline" },
  { icon: NotebookPen, label: "Form your findings" },
  { icon: Gavel, label: "Submit your verdict" },
  { icon: BarChart3, label: "Receive your score" },
];

function WelcomePage() {
  const navigate = useNavigate();
  const completeOnboarding = useSoc((s) => s.completeOnboarding);
  const onboardingCompleted = useSoc((s) => s.onboardingCompleted);
  const accountType = useSoc((s) => s.accountType);
  const accountName = useSoc((s) => s.accountName);

  // Returning users who somehow land back here (bookmark, back-button) skip straight through.
  useEffect(() => {
    if (onboardingCompleted) navigate({ to: "/app" });
  }, [onboardingCompleted, navigate]);

  const enter = () => {
    completeOnboarding();
    navigate({ to: "/app" });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-black px-6 py-12 text-[#EDEDED]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.28]">
        <TopologyDiagram />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% 0%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 65%), linear-gradient(180deg, #000 0%, transparent 22%, transparent 78%, #000 100%)",
        }}
      />

      <Reveal className="relative">
        <Link to="/" className="flex items-center gap-2.5" style={displayFont}>
          <Mark />
          <BrandLockup />
        </Link>
      </Reveal>

      <div className="relative flex flex-1 items-center">
        <div className="w-full max-w-lg">
          <Reveal delay={40}>
            <div
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur"
              style={monoFont}
            >
              <span
                className="size-1.5 rounded-full"
                style={{
                  background: "var(--primary)",
                  boxShadow: "0 0 10px 2px color-mix(in oklab, var(--primary) 60%, transparent)",
                }}
              />
              You're in
            </div>
          </Reveal>

          <Reveal delay={90}>
            <h1
              className="mt-5 text-center text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-white md:text-[38px]"
              style={displayFont}
            >
              Welcome to ThreatLens{accountType === "organization" ? `, ${accountName}` : ""}
            </h1>
          </Reveal>
          <Reveal delay={130}>
            <p className="mt-2.5 text-center text-[14px] text-white/50">
              Real incidents. Real investigation. Real skills.
            </p>
          </Reveal>

          <Reveal delay={190}>
            <div className="mt-9 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-3">
                <div className="icon-frame-dark text-white/85">
                  <Laptop className="size-[18px]" />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-white">
                    Recommended: desktop or laptop
                  </div>
                  <p className="mt-1 text-[12.5px] leading-[1.65] text-white/50">
                    ThreatLens is built around detailed investigation workflows, evidence timelines,
                    and analyst workspaces. The platform is responsive, but you'll get the best
                    investigation experience on a larger screen.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9">
              <div
                className="text-[11px] uppercase tracking-[0.2em] text-white/35"
                style={monoFont}
              >
                What you'll do
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-white/16 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <s.icon className="size-3.5 text-white/50" />
                      <span className="text-[10px] text-white/35" style={monoFont}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12px] leading-[1.4] text-white/75">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <button
              type="button"
              onClick={enter}
              className="btn-primary mt-9 w-full justify-center py-3"
            >
              Continue to ThreatLens <ArrowRight className="size-3.5" />
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
