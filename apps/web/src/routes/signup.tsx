import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Building2, Loader2, User } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { EvidenceGraph, displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/signup")({
  // Same as login: carry the destination, and prefill the address the invite was sent to so
  // the account they create is the one the invite will accept.
  validateSearch: (search: Record<string, unknown>): { next?: string; email?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: SignupPage,
  head: () => ({
    meta: [{ title: "Get Started — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

// ThreatLens's "Individual vs. Organization" choice maps onto SOCVerse's real account
// roles — student (self-service, plays scenarios) vs. instructor (self-service, manages
// cohorts) — rather than a separate org/tenant concept, which SOCVerse doesn't actually
// enforce anywhere yet (see the merge plan's Phase 6). The organization-name/-type fields that
// used to appear here are dropped: SOCVerse's signup has nowhere to store them, and collecting
// input that's silently discarded would be worse than not asking.
const ACCOUNT_OPTIONS = [
  {
    key: "student" as const,
    icon: User,
    label: "Individual",
    description:
      "For cybersecurity students, aspiring analysts, professionals, and independent learners developing practical investigation skills.",
  },
  {
    key: "instructor" as const,
    icon: Building2,
    label: "Organization",
    description:
      "For teams, training institutions, organizations, and cybersecurity groups using structured cybersecurity learning environments.",
  },
];

function SignupPage() {
  const navigate = useNavigate();
  const signup = useAuthStore((s) => s.signup);
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [displayName, setDisplayName] = useState("");
  const { next, email: invitedEmail } = Route.useSearch();
  const afterSignup = next && next.startsWith("/") && !next.startsWith("//") ? next : "/welcome";
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, displayName, role);
      navigate({ to: afterSignup });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

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

            <div className="mt-6">
              <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                Account Type
              </span>
              <Select value={role} onValueChange={(v) => setRole(v as "student" | "instructor")}>
                <SelectTrigger className="h-[52px] w-full rounded-lg border-black/15 bg-black/[0.015] text-[14px] text-[#0A0C0F]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="size-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-black/55">
                {ACCOUNT_OPTIONS.find((opt) => opt.key === role)?.description}
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
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
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-black/70">Password</span>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="12+ characters"
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
                    {role === "instructor" ? "Create organization" : "Get started"}{" "}
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
