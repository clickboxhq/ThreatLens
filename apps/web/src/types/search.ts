import type { LucideIcon } from "lucide-react";
import type { SearchEntityType } from "./socverse-investigation";

// Backed by SOCVerse's real POST /search/mine — the same field=value/freetext query the
// in-case search panel uses, run across every session the Student has ever run instead of
// just the active one.
export type SearchCategory = {
  entityType: SearchEntityType;
  label: string;
  icon: LucideIcon;
  count: number;
};

export type GlobalSearchResult = {
  entityType: SearchEntityType;
  occurredAt: string;
  sessionId: string;
  scenarioTitle: string;
  title: string;
  meta: string;
};
