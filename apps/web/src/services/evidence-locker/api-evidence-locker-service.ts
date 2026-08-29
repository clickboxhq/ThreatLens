import { apiClient } from "@/lib/api-client";
import type { EvidenceLockerService } from "./evidence-locker-service";
import type { EvidenceArtifact } from "@/types/evidence-locker";

const EVENT_TABLE_LABELS: Record<string, string> = {
  sign_in_events: "Sign-in event",
  email_messages: "Email message",
  cloud_events: "Cloud action",
  process_events: "Process event",
  file_events: "File event",
  network_events: "Network connection",
  http_requests: "HTTP request",
};

interface RawEvidenceRow {
  id: string;
  sessionId: string;
  scenarioTitle: string;
  incidentId: string;
  incidentTitle: string;
  eventTable: string;
  justification: string;
  mitreTechnique: { techniqueId: string; name: string } | null;
  pinnedAt: string;
  display: { title: string; summary: string } | null;
}

function toArtifact(row: RawEvidenceRow): EvidenceArtifact {
  return {
    id: row.id,
    sessionId: row.sessionId,
    scenarioTitle: row.scenarioTitle,
    incidentId: row.incidentId,
    incidentTitle: row.incidentTitle,
    eventTable: row.eventTable,
    title: row.display?.title ?? EVENT_TABLE_LABELS[row.eventTable] ?? row.eventTable,
    summary: row.display?.summary ?? "",
    mitreTechnique: row.mitreTechnique,
    justification: row.justification,
    pinnedAt: row.pinnedAt,
  };
}

export const apiEvidenceLockerService: EvidenceLockerService = {
  listMine: async () => {
    const rows = await apiClient.get<RawEvidenceRow[]>("/evidence/mine");
    return rows.map(toArtifact);
  },
};
