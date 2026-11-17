import type { SearchEntityType } from "@/types/threatlens-investigation";

// Shared by the in-case search panel (app.cases.$id.tsx) and Global Search
// (services/search/api-search-service.ts) — both render the same
// GET/POST .../search result shape and should describe a given event identically.
export function labelForResult(
  entityType: SearchEntityType,
  data: Record<string, unknown>,
): string {
  switch (entityType) {
    case "sign_in_event":
      return `Sign-in — ${String(data.result)}`;
    case "email_message":
      return String(data.subject ?? "Email");
    case "cloud_event":
      return `Cloud: ${String(data.actionName)}`;
    case "process_event":
      return `Process: ${String(data.imagePath).split(/[\\/]/).pop()}`;
    case "file_event":
      return `File ${String(data.action)}: ${String(data.filePath)}`;
    case "network_event":
      return `${String(data.direction)} → ${String(data.remoteIp)}:${String(data.remotePort)}`;
    case "http_request":
      return `${String(data.method)} ${String(data.url)}`;
    case "directory_audit_event":
      return String(data.action);
  }
}

/** The specifics of a directory change worth reading at a glance — what group, which
 * rule and where it forwards, which MFA method — from its free-form detail. */
function directoryDetail(detail: unknown): string {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return "";
  const d = detail as Record<string, unknown>;
  return [
    d.group && `group ${String(d.group)}`,
    d.role && `role ${String(d.role)}`,
    d.ruleName && `rule "${String(d.ruleName)}"`,
    d.forwardTo && `→ ${String(d.forwardTo)}`,
    d.method && String(d.method),
    d.ticket && String(d.ticket),
    d.change && String(d.change),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * `nameFor` resolves an identity or device id to a human name.
 *
 * Without it the merged telemetry feed shows a location but never says whose activity it is,
 * so consecutive rows from two colleagues in different offices read as one account moving
 * between countries — which looks exactly like the impossible-travel signal these scenarios
 * elsewhere teach people to spot. The data was always right; the row just never said who.
 */
export function detailForResult(
  entityType: SearchEntityType,
  data: Record<string, unknown>,
  nameFor?: (id: string) => string | undefined,
): string {
  const actor = typeof data.identityId === "string" ? nameFor?.(data.identityId) : undefined;
  const host = typeof data.deviceId === "string" ? nameFor?.(data.deviceId) : undefined;
  const who = actor ?? host;
  const prefix = who ? `${who} · ` : "";

  switch (entityType) {
    case "sign_in_event":
      return `${prefix}${String(data.sourceCity)}, ${String(data.sourceCountry)} · ${String(data.application)}`;
    case "email_message":
      return `From ${String(data.senderAddress)}`;
    case "cloud_event":
      return `${prefix}${String(data.resourceId ?? "")}`.trim();
    case "process_event":
      return `${prefix}${String(data.commandLine)}`;
    case "file_event":
      return `${prefix}${String(data.hashSha256 ?? "")}`.trim();
    case "network_event":
      return `${prefix}${String(data.protocol)} · ${Number(data.bytesSent) + Number(data.bytesReceived)} bytes`;
    case "http_request":
      return `${prefix}${Number(data.statusCode)} · ${String(data.userAgent)}`;
    case "directory_audit_event": {
      // The account it was done to, then who did it and from where — the actor and the source
      // address are what separate a service-desk reset from an attacker in the victim's session.
      const target =
        typeof data.targetIdentityId === "string" ? nameFor?.(data.targetIdentityId) : undefined;
      const specifics = directoryDetail(data.detail);
      return [
        target,
        specifics,
        `by ${String(data.actorDisplayName)} from ${String(data.sourceIp)}`,
      ]
        .filter(Boolean)
        .join(" · ");
    }
  }
}
