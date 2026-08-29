// Backed by SOCVerse's real GET /timeline/mine (apps/api's GlobalTimelineController) — every
// event the Student has curated as relevant (pinned as evidence and/or manually added to a
// timeline) across every incident they've ever worked.
export type TimelineEntityType = "identity" | "device" | "mailbox";

export type GlobalTimelineItem = {
  id: string;
  incidentId: string;
  incidentTitle: string;
  sessionId: string;
  scenarioTitle: string;
  eventTable: string;
  occurredAt: string;
  entityType: TimelineEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  source: ("evidence" | "manual")[];
  relatedItemIds: string[];
};
