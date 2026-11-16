import { useState } from "react";
import { Panel } from "@/components/soc/primitives";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Zap } from "lucide-react";
import type { ResponseActionType } from "@/types/threatlens-investigation";

export interface TakenAction {
  actionType: ResponseActionType;
  targetId: string;
  targetLabel: string;
}

type TargetKind = "device" | "identity";

// Each action names the kind of entity it is taken against. Mailbox-scoped actions resolve to
// the mailbox's owner (the API stores mailbox entities under the identity id), so they pick
// from identities too.
export const RESPONSE_ACTIONS: {
  id: ResponseActionType;
  label: string;
  target: "device" | "identity" | "mailbox";
  picks: TargetKind;
  prompt: string;
  impact: string;
}[] = [
  {
    id: "isolate_device",
    label: "Isolate device",
    target: "device",
    picks: "device",
    prompt: "Which device?",
    impact: "Disconnects it from the corporate network while preserving management access.",
  },
  {
    id: "disable_account",
    label: "Disable account",
    target: "identity",
    picks: "identity",
    prompt: "Which account?",
    impact: "Immediately blocks sign-in for the account.",
  },
  {
    id: "force_password_reset",
    label: "Force password reset",
    target: "identity",
    picks: "identity",
    prompt: "Which account?",
    impact: "Invalidates the current password and requires a new one at next sign-in.",
  },
  {
    id: "revoke_tokens",
    label: "Revoke sessions & tokens",
    target: "identity",
    picks: "identity",
    prompt: "Which account?",
    impact: "Ends every active session and refresh token, across all devices.",
  },
  {
    id: "block_sender",
    label: "Block sender / domain",
    target: "mailbox",
    picks: "identity",
    prompt: "Whose mailbox received it?",
    impact: "Future mail from this sender or domain is rejected at the gateway.",
  },
  {
    id: "block_ip",
    label: "Block IP at egress",
    target: "device",
    picks: "device",
    prompt: "From which device's traffic?",
    impact: "Outbound traffic to the indicator's IP is blocked at the network edge.",
  },
];

/**
 * Response actions get the same pattern real SOC tooling uses: nothing fires on the first
 * click. Pick the entity, confirm, then it lands in the real activity trail — and in the
 * score. Containment is graded on the right action against the right entity, so the picker is
 * not decoration: "isolate a device" earns nothing if it was the wrong device.
 */
export function StageResponse({
  takenActions,
  identities,
  devices,
  locked,
  onLogAction,
  onIsolateDevice,
}: {
  takenActions: TakenAction[];
  identities: { id: string; displayName: string }[];
  devices: { id: string; hostname: string; isolationStatus: string }[];
  locked: boolean;
  onLogAction: (
    actionType: ResponseActionType,
    targetType: string,
    targetId: string,
  ) => Promise<void>;
  onIsolateDevice: (deviceId: string) => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<(typeof RESPONSE_ACTIONS)[number] | null>(
    null,
  );
  const [targetId, setTargetId] = useState("");
  const [working, setWorking] = useState(false);

  const options =
    pendingAction?.picks === "device"
      ? devices.map((d) => ({
          id: d.id,
          label: d.hostname,
          disabled: pendingAction.id === "isolate_device" && d.isolationStatus === "isolated",
          note:
            pendingAction.id === "isolate_device" && d.isolationStatus === "isolated"
              ? "already isolated"
              : undefined,
        }))
      : identities.map((i) => ({
          id: i.id,
          label: i.displayName,
          disabled: false,
          note: undefined,
        }));

  const alreadyTaken = (action: ResponseActionType, id: string) =>
    takenActions.some((t) => t.actionType === action && t.targetId === id);

  const close = () => {
    if (working) return;
    setPendingAction(null);
    setTargetId("");
  };

  const confirm = async () => {
    if (!pendingAction || !targetId) return;
    const chosen = options.find((o) => o.id === targetId);
    setWorking(true);
    try {
      if (pendingAction.id === "isolate_device") {
        await onIsolateDevice(targetId);
      } else {
        await onLogAction(pendingAction.id, pendingAction.target, targetId);
      }
      toast.success(`${pendingAction.label} — ${chosen?.label ?? "target"} — logged.`);
      setPendingAction(null);
      setTargetId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That action did not go through.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Panel title="Response actions">
      <p className="mb-4 text-[12px] leading-relaxed text-secondary">
        Containment is scored: the right action on the right account or device earns it, and where a
        case warrants no action, taking one costs the whole component. Every action asks which
        entity, then asks you to confirm.
      </p>
      <div className="flex flex-col gap-1.5">
        {RESPONSE_ACTIONS.map((a) => {
          const taken = takenActions.filter((t) => t.actionType === a.id);
          return (
            <button
              key={a.id}
              disabled={locked}
              onClick={() => {
                setPendingAction(a);
                setTargetId("");
              }}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left text-[12.5px] transition-colors disabled:opacity-60 ${
                taken.length > 0
                  ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
                  : "border-border bg-background hover:border-[color:var(--info)]/50"
              }`}
            >
              {taken.length > 0 ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <Zap className="size-3.5 shrink-0" />
              )}
              <span className="flex-1">
                <span>{a.label}</span>
                {taken.length > 0 && (
                  <span className="ml-2 text-[10.5px] text-[color:var(--success)]">
                    {taken.map((t) => t.targetLabel).join(", ")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent className="glass-card border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{pendingAction?.label}</AlertDialogTitle>
            <AlertDialogDescription className="text-secondary-foreground">
              {pendingAction?.impact}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="block">
            <span className="t-label mb-1.5 block">{pendingAction?.prompt}</span>
            <select
              autoFocus
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choose…</option>
              {options.map((o) => (
                <option
                  key={o.id}
                  value={o.id}
                  disabled={
                    o.disabled || (pendingAction ? alreadyTaken(pendingAction.id, o.id) : false)
                  }
                >
                  {o.label}
                  {o.note ? ` (${o.note})` : ""}
                  {pendingAction && alreadyTaken(pendingAction.id, o.id) ? " (done)" : ""}
                </option>
              ))}
            </select>
            {options.length === 0 && (
              <span className="mt-1 block text-[10.5px] text-muted-foreground">
                This session has no {pendingAction?.picks === "device" ? "devices" : "accounts"} to
                act on.
              </span>
            )}
          </label>

          <AlertDialogFooter>
            <button type="button" className="btn-app-ghost" disabled={working} onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-app-primary"
              disabled={working || !targetId}
              onClick={confirm}
            >
              {working ? "Working…" : `Confirm ${pendingAction?.label.toLowerCase() ?? ""}`}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
