import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { MarketingPage, Section } from "@/components/soc/marketing/page-shell";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { submitContactForm } from "@/lib/contact";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => {
    const s = seo({
      path: "/contact",
      title: "Let's Talk — ThreatLens",
      description: "Tell us about your team, cohort, or program and we'll follow up.",
    });
    return { meta: s.meta, links: s.links };
  },
});

type Status = "idle" | "submitting" | "success" | "error";

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/35";

function ContactPage() {
  const submit = useServerFn(submitContactForm);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = "Enter your name.";
    if (!email.trim() || !EMAIL_RE.test(email.trim())) errors.email = "Enter a valid work email.";
    if (!message.trim() || message.trim().length < 10) {
      errors.message = "Tell us a little more about what you're looking to do.";
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions while a request is already in flight.
    if (status === "submitting") return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setStatus("error");
      setErrorMessage("Check the fields below and try again.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      await submit({ data: { name, email, organization, message } });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setFieldErrors({});
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong sending your message. Please try again.",
      );
    }
  };

  return (
    <MarketingPage>
      <Section tone="dark" className="!py-20 md:!py-28">
        <div className="mx-auto max-w-lg">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60"
            style={monoFont}
          >
            Let's talk
          </div>
          <h1
            className="mt-5 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:text-[38px]"
            style={displayFont}
          >
            Tell us about your team.
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.7] text-white/55">
            Cohort size, timeline, what you're trying to solve — a few details help us come back
            with something useful instead of a generic pitch.
          </p>

          {status === "success" ? (
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex size-11 items-center justify-center rounded-xl border border-[color:var(--info)]/30 bg-[color:var(--info)]/10 text-[color:var(--info)]">
                <CheckCircle2 className="size-5" />
              </div>
              <h2 className="mt-4 text-[17px] font-semibold text-white" style={displayFont}>
                Message received
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-[1.65] text-white/55">
                Thanks, {name.split(" ")[0]} — we've got your message and will follow up at {email}{" "}
                shortly.
              </p>
            </div>
          ) : (
            <form className="mt-10 space-y-4" onSubmit={handleSubmit} noValidate>
              {status === "error" && errorMessage && (
                <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/10 px-3.5 py-3 text-[13px] text-[#FFD9DA]">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-white/70">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Rivera"
                  className={inputCls}
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <span className="mt-1 block text-[12px] text-[#FF9FA2]">{fieldErrors.name}</span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-white/70">
                  Work email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                  className={inputCls}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <span className="mt-1 block text-[12px] text-[#FF9FA2]">{fieldErrors.email}</span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-white/70">
                  Organization <span className="text-white/35">(optional)</span>
                </span>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="University, bootcamp, or company name"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-white/70">
                  What are you looking to do?
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Cohort size, timeline, what you're trying to solve..."
                  rows={4}
                  className={`${inputCls} resize-none`}
                  aria-invalid={!!fieldErrors.message}
                />
                {fieldErrors.message && (
                  <span className="mt-1 block text-[12px] text-[#FF9FA2]">
                    {fieldErrors.message}
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-primary mt-2 w-full justify-center py-3 disabled:opacity-60"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Send message <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>

              <p className="pt-1 text-center text-[11.5px] text-white/35">
                Prefer email? Reach us directly at{" "}
                <a
                  href="mailto:info@useclickbox.com"
                  className="underline underline-offset-2 hover:text-white/60"
                >
                  info@useclickbox.com
                </a>
              </p>
            </form>
          )}
        </div>
      </Section>
    </MarketingPage>
  );
}
