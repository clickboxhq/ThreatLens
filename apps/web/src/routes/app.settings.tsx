import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { ApiError } from "@/lib/api-client";
import { useMfaStatus, useSetupMfa, useEnableMfa, useDisableMfa } from "@/hooks/use-settings";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Settings" }] }),
});

function SettingsPage() {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title="Settings" description="Your account security." />
      <div className="max-w-xl">
        <MfaPanel />
      </div>
    </div>
  );
}

type MfaStep = "idle" | "setup" | "enabled-now";

function MfaPanel() {
  const { status, isPending } = useMfaStatus();
  const setupMfa = useSetupMfa();
  const enableMfa = useEnableMfa();
  const disableMfa = useDisableMfa();

  const [step, setStep] = useState<MfaStep>("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [enableError, setEnableError] = useState<string | null>(null);

  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);

  async function startSetup() {
    setEnableError(null);
    const result = await setupMfa.mutateAsync();
    setQrCodeDataUrl(result.qrCodeDataUrl);
    setSecret(result.secret);
    setStep("setup");
  }

  async function submitEnable(e: React.FormEvent) {
    e.preventDefault();
    setEnableError(null);
    try {
      const result = await enableMfa.mutateAsync(code);
      setRecoveryCodes(result.recoveryCodes);
      setStep("enabled-now");
    } catch (err) {
      setEnableError(err instanceof ApiError ? err.message : "Could not verify that code.");
    }
  }

  async function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    try {
      await disableMfa.mutateAsync(password);
      setDisabling(false);
      setPassword("");
    } catch (err) {
      setDisableError(err instanceof ApiError ? err.message : "Could not disable two-factor auth.");
    }
  }

  function done() {
    setStep("idle");
    setQrCodeDataUrl(null);
    setSecret(null);
    setCode("");
    setRecoveryCodes(null);
  }

  if (isPending || !status) {
    return (
      <Panel title="Two-factor authentication">
        <div className="flex items-center gap-2 py-4 text-[12.5px] text-secondary">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      </Panel>
    );
  }

  if (step === "enabled-now" && recoveryCodes) {
    return (
      <Panel title="Two-factor authentication">
        <div className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--success)]">
          <CheckCircle2 className="size-4" /> Two-factor authentication is now on
        </div>
        <p className="mt-3 text-[12.5px] text-secondary">
          Save these one-time recovery codes somewhere safe — each can be used once if you lose
          access to your authenticator app. They won't be shown again.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 font-mono text-[12.5px]">
          {recoveryCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <button
          onClick={done}
          className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Done
        </button>
      </Panel>
    );
  }

  if (step === "setup" && qrCodeDataUrl) {
    return (
      <Panel title="Set up two-factor authentication">
        <p className="text-[12.5px] text-secondary">
          Scan this code with an authenticator app (Google Authenticator, 1Password, Authy), then
          enter the 6-digit code it shows.
        </p>
        <img
          src={qrCodeDataUrl}
          alt="Two-factor authentication QR code"
          className="mt-3 size-40 rounded-md border border-border bg-white p-2"
        />
        {secret && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Can't scan it? Enter this code manually:{" "}
            <span className="font-mono text-secondary">{secret}</span>
          </p>
        )}
        <form onSubmit={submitEnable} className="mt-4 flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              6-digit code
            </span>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-9 w-32 rounded-md border border-border bg-background px-3 font-mono text-[13px] tracking-widest focus:outline-none"
              placeholder="000000"
            />
          </label>
          <button
            type="submit"
            disabled={code.length !== 6 || enableMfa.isPending}
            className="h-9 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {enableMfa.isPending ? "Verifying…" : "Enable"}
          </button>
          <button
            type="button"
            onClick={done}
            className="h-9 rounded-md border border-border px-3 text-[12px] text-secondary hover:text-foreground"
          >
            Cancel
          </button>
        </form>
        {enableError && (
          <p className="mt-2 text-[11.5px] text-[color:var(--critical)]">{enableError}</p>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="Two-factor authentication">
      <div className="flex items-start gap-3">
        <ShieldCheck
          className={`mt-0.5 size-5 ${status.enabled ? "text-[color:var(--success)]" : "text-muted-foreground"}`}
        />
        <div className="flex-1">
          <div className="text-[13px] font-medium">
            {status.enabled ? "Enabled" : "Not enabled"}
          </div>
          <p className="mt-0.5 text-[12px] text-secondary">
            {status.mandatory
              ? "Required for your account role — it can't be turned off."
              : "Adds a one-time code from an authenticator app when you log in."}
          </p>

          {!status.enabled && (
            <button
              onClick={startSetup}
              disabled={setupMfa.isPending}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <KeyRound className="size-3.5" />
              {setupMfa.isPending ? "Starting…" : "Set up two-factor authentication"}
            </button>
          )}

          {status.enabled && !status.mandatory && !disabling && (
            <button
              onClick={() => setDisabling(true)}
              className="mt-3 inline-flex h-9 items-center rounded-md border border-border px-3 text-[12px] text-secondary hover:text-foreground"
            >
              Disable
            </button>
          )}

          {disabling && (
            <form onSubmit={submitDisable} className="mt-3 flex items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Confirm password
                </span>
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 w-48 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={!password || disableMfa.isPending}
                className="h-9 rounded-md border border-[color:var(--critical)]/50 px-3 text-[12px] text-[color:var(--critical)] hover:bg-[color:var(--critical)]/10 disabled:opacity-50"
              >
                {disableMfa.isPending ? "Disabling…" : "Confirm disable"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisabling(false);
                  setPassword("");
                  setDisableError(null);
                }}
                className="h-9 rounded-md border border-border px-3 text-[12px] text-secondary hover:text-foreground"
              >
                Cancel
              </button>
            </form>
          )}
          {disableError && (
            <p className="mt-2 text-[11.5px] text-[color:var(--critical)]">{disableError}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
