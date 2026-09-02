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
  }
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
  }
}
