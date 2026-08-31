import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  FileSearch,
  Gavel,
  Laptop,
  Lightbulb,
  Loader2,
  NotebookPen,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { Reveal, TopologyDiagram, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { useAuthStore, useAuthUser, type ExperienceLevel } from "@/lib/auth-store";
import { organizationsService } from "@/services/organizations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "new_to_security", label: "New to security" },
  { value: "early_career", label: "Early career (0–2 years)" },
  { value: "experienced", label: "Experienced analyst" },
  { value: "career_switcher", label: "Career switcher" },
];

function useOnboardingStep() {
  const user = useAuthUser();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const isOrg = user?.role === "instructor";
  const [submitting, setSubmitting] = useState(false);
  const [careerGoal, setCareerGoal] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">("");
  const [orgName, setOrgName] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");

  const save = async () => {
    setSubmitting(true);
    try {
      if (isOrg) {
        if (orgName.trim()) {
          await organizationsService.create(orgName.trim());
          await organizationsService.rename(orgName.trim(), {
            teamSize: teamSize ? Number(teamSize) : undefined,
            industry: industry.trim() || undefined,
          });
        }
      } else if (careerGoal.trim() || experienceLevel) {
        await updateProfile({
          careerGoal: careerGoal.trim() || undefined,
          experienceLevel: experienceLevel || undefined,
        });
      }
    } catch {
      toast.error("Couldn't save that just now — you can always add it later from Settings.");
    } finally {
      setSubmitting(false);
    }
  };

  return { isOrg, submitting, save, orgName, setOrgName, teamSize, setTeamSize, industry, setIndustry, careerGoal, setCareerGoal, experienceLevel, setExperienceLevel };
}

function WelcomePage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const onboarding = OnboardingStep();

  // Only signup.tsx ever links here, right after a fresh signup — nothing else in the app
  // navigates to /welcome, so there's no "returning user" case to guard against beyond someone
  // hitting back/bookmark within that same signed-in session, which just re-shows this screen
  // (harmless) rather than needing a persisted, easy-to-get-wrong-across-accounts flag.
  const enter = async () => {
    await onboarding.save();
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
              Welcome to ThreatLens{user ? `, ${user.displayName}` : ""}
            </h1>
          </Reveal>
          <Reveal delay={130}>
            <p className="mt-2.5 text-center text-[14px] text-white/50">
              Real incidents. Real investigation. Real skills.
            </p>
          </Reveal>

          <Reveal delay={190}>
            <div className="mt-9 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]">
              <div className="text-[13.5px] font-semibold text-white">
                {onboarding.isOrg ? "Set up your organization" : "A couple quick things"}
              </div>
              <p className="mt-1 text-[12px] leading-[1.6] text-white/45">
                Optional — helps us point you at the right scenarios. You can skip this and add it
                later from Settings.
              </p>

              {onboarding.isOrg ? (
                <div className="mt-4 space-y-3">
                  <input
                    value={onboarding.orgName}
                    onChange={(e) => onboarding.setOrgName(e.target.value)}
                    placeholder="Organization name"
                    className="h-10 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={onboarding.teamSize}
                      onChange={(e) => onboarding.setTeamSize(e.target.value.replace(/\D/g, ""))}
                      placeholder="Team size"
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                    />
                    <input
                      value={onboarding.industry}
                      onChange={(e) => onboarding.setIndustry(e.target.value)}
                      placeholder="Industry"
                      className="h-10 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <input
                    value={onboarding.careerGoal}
                    onChange={(e) => onboarding.setCareerGoal(e.target.value)}
                    placeholder="Career goal (e.g. land a Tier 1 SOC role)"
                    className="h-10 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                  />
                  <Select
                    value={onboarding.experienceLevel}
                    onValueChange={(v) => onboarding.setExperienceLevel(v as never)}
                  >
                    <SelectTrigger className="h-10 w-full border-white/12 bg-white/[0.03] text-[13px] text-white">
                      <SelectValue placeholder="Experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="mt-4 flex items-start gap-2.5 border-t border-white/8 pt-4">
                <Laptop className="mt-0.5 size-3.5 shrink-0 text-white/40" />
                <p className="text-[11.5px] leading-[1.6] text-white/40">
                  Recommended: desktop or laptop — ThreatLens is built around detailed
                  investigation workflows and analyst workspaces that are responsive but shine on
                  a larger screen.
                </p>
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
              disabled={onboarding.submitting}
              className="btn-primary mt-9 w-full justify-center py-3 disabled:opacity-60"
            >
              {onboarding.submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  Continue to ThreatLens <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
