import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { usePlatformSettings, useUpdateSettings } from "@/hooks/use-admin";
import type { PlatformSettings } from "@/types/admin";

export const Route = createFileRoute("/app/admin/settings")({
  component: AdminSettings,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Platform Settings" }] }),
});

const inputCls =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Toggle({
  label,
  hint,
  checked,
  onChange,
  danger,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span
          className={
            "block text-[13px] font-medium " +
            (danger && checked ? "text-[color:var(--critical)]" : "")
          }
        >
          {label}
        </span>
        <span className="block text-[11.5px] leading-relaxed text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[color:var(--info)]"
      />
    </label>
  );
}

function AdminSettings() {
  const { data, isPending, isError } = usePlatformSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const dirty = data && form && JSON.stringify(data) !== JSON.stringify(form);

  const save = (next: PlatformSettings) => {
    const patch: Partial<PlatformSettings> = {};
    if (data) {
      (Object.keys(next) as (keyof PlatformSettings)[]).forEach((k) => {
        if (JSON.stringify(data[k]) !== JSON.stringify(next[k])) {
          (patch as Record<string, unknown>)[k] = next[k];
        }
      });
    }
    update.mutate(patch);
  };

  return (
    <AdminPage
      title="Platform Settings"
      description="Global configuration. Secrets (email keys, signing secrets, provider credentials) stay in environment variables and are never shown or set here."
    >
      {isPending || !form ? (
        <Skeleton className="h-72" />
      ) : isError ? (
        <EmptyState title="Unavailable" description="Restricted to platform administrators." />
      ) : (
        <div className="max-w-2xl space-y-4">
          <Panel title="General">
            <label className="block">
              <span className="t-label mb-1 block">Platform name</span>
              <input
                className={inputCls}
                value={form.platformName}
                onChange={(e) => setForm({ ...form, platformName: e.target.value })}
              />
            </label>
            <label className="mt-3 block">
              <span className="t-label mb-1 block">Default trial length (days)</span>
              <input
                type="number"
                min={0}
                max={90}
                className={inputCls}
                value={form.defaultTrialDays}
                onChange={(e) =>
                  setForm({ ...form, defaultTrialDays: Number(e.target.value) || 0 })
                }
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Applied to a new individual subscription once billing is connected.
              </span>
            </label>
          </Panel>

          <Panel title="Access">
            <div className="divide-y divide-border">
              <Toggle
                label="Self-serve registration"
                hint="When off, new sign-ups are refused. Existing accounts are unaffected."
                checked={form.registrationEnabled}
                onChange={(v) => setForm({ ...form, registrationEnabled: v })}
              />
              <Toggle
                label="Maintenance mode"
                danger
                hint="Turns away all non-admin API traffic with a 503. Admins and the sign-in flow stay reachable so you can turn it back off."
                checked={form.maintenanceMode}
                onChange={(v) => {
                  if (v) setConfirmMaintenance(true);
                  else setForm({ ...form, maintenanceMode: false });
                }}
              />
            </div>
          </Panel>

          <div className="flex items-center gap-2">
            <button
              className="btn-app-primary"
              disabled={!dirty || update.isPending}
              onClick={() => save(form)}
            >
              {update.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Save changes
            </button>
            {dirty && (
              <button className="btn-app-ghost" onClick={() => data && setForm(data)}>
                Discard
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmMaintenance}
        onOpenChange={(o) => {
          setConfirmMaintenance(o);
          if (!o && form && !form.maintenanceMode) {
            // cancelled — leave the toggle off
          }
        }}
        title="Turn on maintenance mode?"
        description="Every non-admin request to the API will be refused with a 503 until you turn this off."
        note="Sign-in and the admin panel stay reachable. Learners will be unable to use ThreatLens."
        confirmLabel="Enable maintenance mode"
        tone="destructive"
        typeToConfirm="MAINTENANCE"
        onConfirm={async () => {
          if (form) {
            const next = { ...form, maintenanceMode: true };
            setForm(next);
            await update.mutateAsync({ maintenanceMode: true });
          }
        }}
      />
    </AdminPage>
  );
}
