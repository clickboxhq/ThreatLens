import type {
  SessionListItemDto,
  SkillRadarEntryDto,
  TechniqueMasteryEntryDto,
} from "@/types/socverse-operations";

/** The student's own session history — backs Case Management, Incident Queue, and resolving
 * which session the Alert Center / investigation portals should currently show. */
export interface SessionsService {
  listMine(): Promise<SessionListItemDto[]>;
  /** Per-MITRE-tactic proficiency rollup across every scored session — backs the dashboard's
   * mastery grid and its weak-tactic scenario recommendation. */
  getSkillRadar(): Promise<SkillRadarEntryDto[]>;
  /** Same rollup, per individual technique — backs the MITRE ATT&CK Explorer's technique table. */
  getTechniqueMastery(): Promise<TechniqueMasteryEntryDto[]>;
}
