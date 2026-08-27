import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Loader2, User } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { EvidenceGraph, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { useSoc, type AccountType } from "@/lib/store";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [{ title: "Get Started — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const ACCOUNT_OPTIONS = [
  {
    key: "individual" as const,
    icon: User,
    label: "Individual",
    body: "Personal learning and investigation practice.",
    features: ["Personal investigations", "Learning paths", "Certificates", "Progress tracking"],
  },
  {
    key: "organization" as const,
    icon: Building2,
    label: "Organization",
    body: "Manage analysts, students, cohorts, and training programs.",
    features: ["Cohorts", "Instructor management", "Reporting", "Team analytics"],
  },
];

const ORG_TYPES = [
  "Company / Enterprise",
  "University / Higher Education",
  "Bootcamp",
  "Cybersecurity Academy",
  "MSSP / Security Provider",
  "Government Agency",
  "Workforce Development Program",
  "Training Provider",
  "Accelerator",
  "Incubator",
  "Nonprofit",
  "Other",
];

function SignupPage() {
  const navigate = useNavigate();
  const setAccountType = useSoc((s) => s.setAccountType);
  const [type, setType] = useState<AccountType>("individual");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* left — brand panel */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-16"
        style={{ background: "#000000", color: "#EDEDED" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-35">
          <EvidenceGraph />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #000 5%, transparent 40%, transparent 60%, #000 95%)",
          }}
        />

        <Link to="/" className="relative flex items-center gap-2.5" style={displayFont}>
          <Mark />
          <BrandLockup />
        </Link>

        <div className="relative max-w-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40" style={monoFont}>
            Security Investigation Platform
          </div>
          <h1
            className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-white xl:text-[32px]"
            style={displayFont}
          >
            Build practical security investigation skills.
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.7] text-white/50">
            Work through realistic security incidents, develop evidence-driven investigation skills,
            and measure your progress — whether you're learning independently or managing a security
            training program.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-white/35" style={monoFont}>
            Built for individuals and organizations
          </p>
        </div>

        <div aria-hidden className="relative h-4" />
      </div>

      {/* right — form panel */}
      <div className="flex min-h-screen flex-col bg-white text-[#0A0C0F]">
        <div className="flex items-center justify-between px-6 py-5 lg:justify-end lg:px-10">
          <Link to="/" className="flex items-center gap-2.5 lg:hidden" style={displayFont}>
            <Mark />
            <span className="text-[15px] font-semibold text-[#0A0C0F]">ThreatLens</span>
          </Link>
          <Link
            to="/login"
            className="text-[13px] text-black/55 transition-colors hover:text-black"
          >
            Already have an account? <span className="font-medium text-[#0A0C0F]">Login</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[480px]">
            <h2
              className="text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
              style={displayFont}
            >
              Get Started with ThreatLens
            </h2>
            <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
              Choose how you will use ThreatLens.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACCOUNT_OPTIONS.map((opt) => {
                const active = type === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setType(opt.key)}
                    className={
                      active
                        ? "glass-card-dark relative p-5 text-left transition-all"
                        : "relative rounded-xl border border-black/12 bg-black/[0.015] p-5 text-left transition-all hover:border-black/25"
                    }
                  >
                    {active && (
                      <CheckCircle2 className="absolute right-4 top-4 size-4 text-white" />
                    )}
                    <div
                      className={
                        active
                          ? "icon-frame-dark text-white/85"
                          : "flex size-11 shrink-0 items-center justify-center rounded-md border border-black/12 bg-black/[0.03] text-black/70"
                      }
                    >
                      <opt.icon className="size-[18px]" />
                    </div>
                    <div
                      className={`mt-3.5 text-[14px] font-semibold ${active ? "text-white" : "text-[#0A0C0F]"}`}
                      style={displayFont}
                    >
                      {opt.label}
                    </div>
                    <div
                      className={`mt-1 text-[11.5px] leading-[1.5] ${active ? "text-white/55" : "text-black/50"}`}
                    >
                      {opt.body}
                    </div>
                    <ul className="mt-3 space-y-1">
                      {opt.features.map((f) => (
                        <li
                          key={f}
                          className={`flex items-center gap-1.5 text-[11px] ${active ? "text-white/65" : "text-black/60"}`}
                        >
                          <span
                            className={`size-1 shrink-0 rounded-full ${active ? "bg-white/50" : "bg-black/40"}`}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setSubmitting(true);
                // Mock-only: a real backend call would replace this timeout.
                // Try email "taken@contoso.com" to see the already-registered state.
                window.setTimeout(() => {
                  if (email === "taken@contoso.com") {
                    setSubmitting(false);
                    setError("An account with this email already exists. Try logging in instead.");
                    return;
                  }
                  setAccountType(
                    type,
                    type === "organization" ? orgName || "My Organization" : undefined,
                  );
                  navigate({ to: "/welcome" });
                }, 500);
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                  Work email
                </span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                  className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                />
              </label>
              {type === "organization" && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                      Organization name
                    </span>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Contoso University"
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                      Organization type
                    </span>
                    <select
                      required
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors focus:border-black/40"
                    >
                      <option value="" disabled>
                        Select organization type
                      </option>
                      {ORG_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-black/70">Password</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                />
              </label>

              {error && (
                <p className="rounded-lg border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/5 px-3 py-2 text-[12.5px] text-[color:var(--critical)]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary mt-2 w-full justify-center py-3 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Creating account…
                  </>
                ) : (
                  <>
                    {type === "organization" ? "Create organization" : "Get started"}{" "}
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-black/8 px-6 py-5 text-[12px] text-black/40">
          <Link to="/privacy" className="hover:text-black/70">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-black/70">
            Terms of Service
          </Link>
          <Link to="/security" className="hover:text-black/70">
            Security
          </Link>
          <a href="mailto:info@useclickbox.com" className="hover:text-black/70">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
