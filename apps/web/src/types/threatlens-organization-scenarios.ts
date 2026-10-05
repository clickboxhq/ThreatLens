// Types matching apps/api/src/modules/organizations/organization-scenarios.service.ts.

export type AssignmentStatus = "assigned" | "in_progress" | "completed" | "overdue";

/** The org admin's own scenario-management table row (GET /organizations/mine/scenarios). */
export interface OrganizationScenarioDto {
  id: string;
  scenarioId: string;
  title: string;
  difficulty: string;
  category: string;
  estimatedMinutes: number;
  assignedCount: number;
  dueAt: string | null;
  addedAt: string;
}

/** A student's own assignment row (GET /assigned-scenarios/mine). */
export interface AssignedScenarioDto {
  assignmentId: string;
  scenarioId: string;
  scenarioSlug: string;
  title: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  organizationName: string;
  assignedAt: string;
  dueAt: string | null;
  status: AssignmentStatus;
  scorePercent: number | null;
}
