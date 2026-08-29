import type { SearchEntityType } from "@/types/socverse-investigation";

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

export function detailForResult(
  entityType: SearchEntityType,
  data: Record<string, unknown>,
): string {
  switch (entityType) {
    case "sign_in_event":
      return `${String(data.sourceCity)}, ${String(data.sourceCountry)} · ${String(data.application)}`;
    case "email_message":
      return `From ${String(data.senderAddress)}`;
    case "cloud_event":
      return String(data.resourceId ?? "");
    case "process_event":
      return String(data.commandLine);
    case "file_event":
      return String(data.hashSha256 ?? "");
    case "network_event":
      return `${String(data.protocol)} · ${Number(data.bytesSent) + Number(data.bytesReceived)} bytes`;
    case "http_request":
      return `${Number(data.statusCode)} · ${String(data.userAgent)}`;
  }
}
