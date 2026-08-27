import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "threatlens:cookie-consent";

type Consent = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

function writeConsent(consent: Consent) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

/** Dispatch this to reopen the banner from anywhere (e.g. a "Cookie Settings" footer link). */
export const OPEN_COOKIE_SETTINGS_EVENT = "open-cookie-settings";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setVisible(!readConsent());
    const reopen = () => {
      const existing = readConsent();
      if (existing) {
        setAnalytics(existing.analytics);
        setMarketing(existing.marketing);
      }
      setManaging(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const decide = (consent: Omit<Consent, "decidedAt">) => {
    writeConsent({ ...consent, decidedAt: new Date().toISOString() });
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6">
      <div
        className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
        style={{ background: "rgba(8,10,13,0.96)" }}
      >
        <button
          onClick={() => decide({ essential: true, analytics: false, marketing: false })}
          aria-label="Dismiss"
          className="absolute right-4 top-4 text-white/35 transition-colors hover:text-white"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/85">
            <Cookie className="size-4" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-white">We value your privacy</div>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-white/55">
              We use cookies to operate this site, understand usage, and improve the product. You
              can accept all or manage your preferences. Read our{" "}
              <Link to="/privacy" className="text-white underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {managing && (
          <div className="mt-4 space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <PreferenceRow
              label="Essential"
              desc="Required for login and core functionality."
              locked
            />
            <PreferenceRow
              label="Analytics"
              desc="Helps us understand how the product is used."
              checked={analytics}
              onChange={setAnalytics}
            />
            <PreferenceRow
              label="Marketing"
              desc="Used to measure the effectiveness of campaigns."
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => decide({ essential: true, analytics: true, marketing: true })}
            className="btn-primary text-[12.5px]"
          >
            Accept All
          </button>
          {managing ? (
            <button
              onClick={() => decide({ essential: true, analytics, marketing })}
              className="btn-ghost text-[12.5px]"
            >
              Save preferences
            </button>
          ) : (
            <button onClick={() => setManaging(true)} className="btn-ghost text-[12.5px]">
              Manage Preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({
  label,
  desc,
  checked,
  locked,
  onChange,
}: {
  label: string;
  desc: string;
  checked?: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[12.5px] font-medium text-white/85">{label}</div>
        <div className="text-[11.5px] text-white/40">{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={locked ? true : checked}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-white disabled:opacity-40"
      />
    </label>
  );
}
