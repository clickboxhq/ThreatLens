import { useState } from "react";
import { Panel } from "@/components/soc/primitives";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { toast } from "sonner";
import { CheckCircle2, Zap } from "lucide-react";
import type { ResponseActionType } from "@/types/threatlens-investigation";

// Response actions have no entity picker server-side (LogResponseActionDto only ever accepts
// {actionType, targetType} — see incident.dto.ts) — the audit trail records the incident, not
// a specific device/identity/mailbox id. The impact copy below is honest about that: it names
// the category the action applies to, not a fabricated hostname the backend never actually
// receives.
const RESPONSE_ACTIONS: {
  id: ResponseActionType;
  label: string;
  target: string;
  targetLabel: string;
  impact: string;
}[] = [
  {
    id: "isolate_device",
    label: "Isolate device",
    target: "device",
    targetLabel: "This device (the one you're currently investigating)",
    impact:
      "Disconnects the endpoint from the corporate network while preserving management access.",
  },
  {
    id: "disable_account",
    label: "Disable account",
    target: "identity",
    targetLabel: "This identity",
    impact: "Immediately blocks sign-in for the account under investigation.",
  },
  {
    id: "force_password_reset",
    label: "Force password reset",
    target: "identity",
    targetLabel: "This identity",
    impact: "Invalidates the account's current password and requires a new one at next sign-in.",
  },
  {
    id: "revoke_tokens",
    label: "Revoke sessions & tokens",
    target: "identity",
    targetLabel: "This identity",
    impact: "Ends every active session and refresh token for the account, across all devices.",
  },
  {
    id: "block_sender",
    label: "Block sender / domain",
    target: "mailbox",
    targetLabel: "This mailbox / sending domain",
    impact: "Future mail from this sender or domain is rejected at the mail gateway.",
  },
  {
    id: "block_ip",
    label: "Block IP at egress",
    target: "device",
    targetLabel: "This device's network egress",
    impact: "Outbound traffic to the indicator's IP is blocked at the network edge.",
  },
];

/**
 * Response actions get the same enterprise pattern real SOC tooling uses: nothing fires on the
 * first click. Confirm -> pending -> success, and every action lands in the real activity trail
 * (logResponseAction -> InvestigationAction, already visible via ActivityLogPanel) — this stage
 * adds the confirmation step and success feedback, it doesn't add any new backend behavior.
 */
export function StageResponse({
  takenActions,
  locked,
  onLogAction,
}: {
  takenActions: ResponseActionType[];
  locked: boolean;
  onLogAction: (actionType: ResponseActionType, targetType: string) => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<(typeof RESPONSE_ACTIONS)[number] | null>(
    null,
  );

  return (
    <Panel title="Response actions">
      <p className="mb-4 text-[12px] text-secondary">
        Containment is scored. Taking the wrong action — or the right one too late — affects your
        rubric, so each one asks you to confirm before it's logged.
      </p>
      <div className="flex flex-col gap-1.5">
        {RESPONSE_ACTIONS.map((a) => {
          const taken = takenActions.includes(a.id);
          return (
            <button
              key={a.id}
              disabled={locked || taken}
              onClick={() => setPendingAction(a)}
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-[12.5px] transition-colors disabled:opacity-60 ${
                taken
                  ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
                  : "border-border bg-background hover:border-[color:var(--info)]/50"
              }`}
            >
              {taken ? <CheckCircle2 className="size-3.5" /> : <Zap className="size-3.5" />}
              <span className="flex-1 text-left">{a.label}</span>
              {taken && <span className="text-[10.5px] text-[color:var(--success)]">Taken</span>}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        tone="default"
        title="Confirm response action"
        description={pendingAction ? `Action: ${pendingAction.label}` : ""}
        target={pendingAction?.targetLabel}
        note={pendingAction?.impact}
        confirmLabel={pendingAction ? `Confirm ${pendingAction.label.toLowerCase()}` : "Confirm"}
        onConfirm={async () => {
          if (!pendingAction) return;
          await onLogAction(pendingAction.id, pendingAction.target);
          toast.success(`${pendingAction.label} logged at ${new Date().toLocaleTimeString()}.`);
        }}
      />
    </Panel>
  );
}
