import { useState } from "react";
import {
  useIdentityProfile,
  useIdentitySignIns,
  useIdentityCloudEvents,
} from "@/hooks/use-identities";
import {
  EntityDrawerShell,
  DrawerEmpty,
  EventRow,
  formatEventTime,
} from "@/components/soc/entity-drawer-shell";
import { Loader2 } from "lucide-react";

type Tab = "profile" | "signins" | "cloud";

const TABS = [
  ["profile", "Profile"],
  ["signins", "Sign-in history"],
  ["cloud", "Cloud activity"],
] as const;

const RISK_TONE: Record<string, string> = {
  high: "text-[color:var(--critical)]",
  medium: "text-[color:var(--warning)]",
  low: "text-[color:var(--info)]",
  none: "text-muted-foreground",
};

const MFA_LABEL: Record<string, string> = {
  enforced: "Enforced",
  registered_not_enforced: "Registered, not enforced",
  not_registered: "Not registered",
};

/**
 * The identity pivot — "whose account is this, and what else did they do?". Backs the identity,
 * email and cloud scenarios: impossible travel and password spraying are only visible once you
 * can see one account's sign-ins together, and OAuth/access-key abuse only once you can see its
 * cloud-plane actions.
 */
export function IdentityDetailDrawer({
  sessionId,
  identityId,
  onClose,
}: {
  sessionId: string;
  identityId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const { data: identity, isPending } = useIdentityProfile(sessionId, identityId);

  return (
    <EntityDrawerShell
      kind="Identity"
      title={isPending ? "Loading…" : (identity?.displayName ?? "Unknown identity")}
      subtitle={identity?.userPrincipalName}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      onClose={onClose}
    >
      {isPending || !identity ? (
        <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
          <Loader2 className="size-4 animate-spin" /> Loading identity…
        </div>
      ) : (
        <>
          {tab === "profile" && (
            <div className="space-y-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
                <dt className="text-muted-foreground">Department</dt>
                <dd>{identity.department}</dd>
                <dt className="text-muted-foreground">Job title</dt>
                <dd>{identity.jobTitle}</dd>
                <dt className="text-muted-foreground">Home country</dt>
                <dd>{identity.homeCountry}</dd>
                <dt className="text-muted-foreground">Risk level</dt>
                <dd className={RISK_TONE[identity.riskLevel] ?? ""}>{identity.riskLevel}</dd>
                <dt className="text-muted-foreground">MFA</dt>
                <dd
                  className={identity.mfaStatus === "enforced" ? "" : "text-[color:var(--warning)]"}
                >
                  {MFA_LABEL[identity.mfaStatus] ?? identity.mfaStatus}
                </dd>
                <dt className="text-muted-foreground">Account status</dt>
                <dd
                  className={
                    identity.accountStatus === "active" ? "" : "text-[color:var(--warning)]"
                  }
                >
                  {identity.accountStatus}
                </dd>
                <dt className="text-muted-foreground">Privileged</dt>
                <dd className={identity.isPrivileged ? "text-[color:var(--critical)]" : ""}>
                  {identity.isPrivileged ? "Yes — elevated access" : "No"}
                </dd>
              </dl>

              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Devices ({identity.devices.length})
                </div>
                {identity.devices.length === 0 ? (
                  <DrawerEmpty>No devices are associated with this identity.</DrawerEmpty>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {identity.devices.map((d) => (
                      <EventRow
                        key={d.id}
                        title={d.hostname}
                        meta={`${d.osPlatform} · risk ${d.riskLevel}`}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === "signins" && <SignInsTab sessionId={sessionId} identityId={identityId} />}
          {tab === "cloud" && <CloudTab sessionId={sessionId} identityId={identityId} />}
        </>
      )}
    </EntityDrawerShell>
  );
}

function SignInsTab({ sessionId, identityId }: { sessionId: string; identityId: string }) {
  const { data: signIns, isPending } = useIdentitySignIns(sessionId, identityId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Loading sign-ins…
      </div>
    );
  }
  if (!signIns || signIns.length === 0) {
    return <DrawerEmpty>No sign-ins recorded for this identity.</DrawerEmpty>;
  }

  // Distinct countries are the impossible-travel / atypical-location tell — surfaced up front
  // so it doesn't depend on the analyst eyeballing every row.
  const countries = [...new Set(signIns.map((s) => s.sourceCountry))];
  const failures = signIns.filter((s) => s.result !== "success").length;
  const legacyAuth = signIns.filter((s) => s.isLegacyAuth).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-[11.5px]">
        <span>
          <span className="text-muted-foreground">Sign-ins:</span> {signIns.length}
        </span>
        <span className={countries.length > 1 ? "text-[color:var(--warning)]" : ""}>
          <span className="text-muted-foreground">Countries:</span> {countries.join(", ")}
        </span>
        {failures > 0 && (
          <span className="text-[color:var(--warning)]">
            <span className="text-muted-foreground">Failed:</span> {failures}
          </span>
        )}
        {legacyAuth > 0 && (
          <span className="text-[color:var(--warning)]">
            <span className="text-muted-foreground">Legacy auth:</span> {legacyAuth}
          </span>
        )}
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {signIns.map((s) => (
          <EventRow
            key={s.id}
            tone={s.result === "success" ? "normal" : "warning"}
            title={`${s.result === "success" ? "Successful" : "Failed"} sign-in — ${s.sourceCity}, ${s.sourceCountry}`}
            detail={`${s.sourceIp} · ${s.application}${s.isLegacyAuth ? " · legacy auth" : ""}`}
            meta={`${formatEventTime(s.occurredAt)}${s.failureReason ? ` · ${s.failureReason}` : ""}`}
          />
        ))}
      </ul>
    </div>
  );
}

function CloudTab({ sessionId, identityId }: { sessionId: string; identityId: string }) {
  const { data: events, isPending } = useIdentityCloudEvents(sessionId, identityId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Loading cloud activity…
      </div>
    );
  }
  if (!events || events.length === 0) {
    return <DrawerEmpty>No cloud-plane activity for this identity in this session.</DrawerEmpty>;
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {events.map((e) => (
        <EventRow
          key={e.id}
          title={e.actionName}
          detail={e.resourceId ?? undefined}
          meta={`${formatEventTime(e.occurredAt)} · ${e.provider} · from ${e.sourceIp}`}
        />
      ))}
    </ul>
  );
}
