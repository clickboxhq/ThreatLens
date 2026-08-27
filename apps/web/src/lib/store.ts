import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  alerts as seedAlerts,
  incidents as seedIncidents,
  identities as seedIdentities,
  endpoints as seedEndpoints,
  scenarios as seedScenarios,
} from "./soc-data";
import { securityEvents } from "@/services/investigations/telemetry-data";
import { scoreCase } from "@/services/investigations/scoring";
import type { Note } from "@/types/common";
import type { Alert, AlertStatus } from "@/types/alerts";
import type { Incident } from "@/types/incidents";
import type { Identity } from "@/types/identities";
import type { Endpoint } from "@/types/endpoints";
import type { Scenario } from "@/types/scenarios";
import type { EmailVerdict, EmailCaseState } from "@/types/email";
import type { AccountType } from "@/types/account";
import type {
  CaseStatus,
  CaseVerdict,
  EvidenceItem,
  ActionLogEntry,
  ScoreBreakdown,
  CaseState,
} from "@/types/investigations";

export type { AccountType } from "@/types/account";

const emptyCase = (): CaseState => ({
  status: "open",
  summary: "",
  techniqueTags: [],
  evidence: [],
  timeline: [],
  notes: [],
  actions: [],
  hintsUsed: 0,
  statusHistory: [],
});

const EMPTY_CASE: CaseState = emptyCase();

type SocState = {
  accountType: AccountType;
  accountName: string;
  setAccountType: (type: AccountType, name?: string) => void;

  onboardingCompleted: boolean;
  completeOnboarding: () => void;

  alerts: Alert[];
  incidents: Incident[];
  identities: Identity[];
  endpoints: Endpoint[];
  scenarios: Scenario[];
  emailCases: Record<string, EmailCaseState>;
  scenarioProgress: Record<string, number>;
  cases: Record<string, CaseState>;
  globalTimeline: string[];

  // alerts
  setAlertStatus: (id: string, status: AlertStatus) => void;
  assignAlert: (id: string, analyst: string) => void;
  resolveAlert: (id: string) => void;
  escalateAlert: (id: string) => void;
  addAlertNote: (id: string, note: Omit<Note, "id" | "ts">) => void;
  dismissAlert: (id: string, reason: string) => void;
  promoteAlert: (id: string, incidentId: string) => void;

  setIncidentStatus: (id: string, status: string) => void;
  addIncidentNote: (id: string, note: Omit<Note, "id" | "ts">) => void;

  // case management
  setCaseStatus: (id: string, status: CaseStatus) => void;
  pinEvidence: (id: string, eventId: string, justification: string) => void;
  unpinEvidence: (id: string, eventId: string) => void;
  tagEvidence: (id: string, eventId: string, technique: string) => void;
  addToTimeline: (id: string, eventId: string) => void;
  removeFromTimeline: (id: string, eventId: string) => void;
  addCaseNote: (id: string, body: string) => void;
  toggleTechniqueTag: (id: string, technique: string) => void;
  setCaseSummary: (id: string, summary: string) => void;
  useHint: (id: string) => void;
  logAction: (id: string, entry: Omit<ActionLogEntry, "id" | "ts" | "actor">) => void;
  submitCase: (id: string, verdict: CaseVerdict) => void;
  reopenCase: (id: string, feedback: string) => void;

  // entities
  toggleIsolate: (host: string) => void;

  submitEmailVerdict: (caseId: string, verdict: EmailVerdict, score: number) => void;
  addEmailNote: (caseId: string, note: Omit<Note, "id" | "ts">) => void;

  setScenarioProgress: (id: string, pct: number) => void;

  reset: () => void;
};

type SeedSlice = Pick<
  SocState,
  | "alerts"
  | "incidents"
  | "identities"
  | "endpoints"
  | "scenarios"
  | "emailCases"
  | "scenarioProgress"
  | "cases"
  | "globalTimeline"
>;

const seed = (): SeedSlice => ({
  alerts: seedAlerts.map((a) => ({ ...a, notes: [] as Note[] })) as Alert[],
  incidents: seedIncidents.map((i) => ({ ...i, notes: [] as Note[] })) as Incident[],
  identities: [...seedIdentities],
  endpoints: [...seedEndpoints],
  scenarios: [...seedScenarios],
  emailCases: {} as Record<string, EmailCaseState>,
  scenarioProgress: Object.fromEntries(seedScenarios.map((s) => [s.id, s.completion])),
  cases: {},
  globalTimeline: [],
});

const nowStr = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const rid = () => Math.random().toString(36).slice(2, 10);
const ANALYST = "John Doe";

const withCase = (s: SocState, id: string, fn: (c: CaseState) => CaseState) => ({
  cases: { ...s.cases, [id]: fn(s.cases[id] ?? emptyCase()) },
});

export const useSoc = create<SocState>()(
  persist(
    (set) => ({
      ...seed(),

      accountType: "individual",
      accountName: "Personal Workspace",
      setAccountType: (type, name) =>
        set(() => ({
          accountType: type,
          accountName: name ?? (type === "organization" ? "My Organization" : "Personal Workspace"),
        })),

      onboardingCompleted: false,
      completeOnboarding: () => set(() => ({ onboardingCompleted: true })),

      setAlertStatus: (id, status) =>
        set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, status } : a)) })),
      assignAlert: (id, analyst) =>
        set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, analyst } : a)) })),
      resolveAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: "resolved" } : a)),
        })),
      escalateAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: "escalated" } : a)),
        })),
      addAlertNote: (id, note) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id
              ? { ...a, notes: [...(a.notes ?? []), { ...note, id: rid(), ts: nowStr() }] }
              : a,
          ),
        })),
      dismissAlert: (id, reason) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, status: "closed", dismissReason: reason } : a,
          ),
        })),
      promoteAlert: (id, incidentId) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, status: "escalated", incidentId } : a,
          ),
          incidents: s.incidents.map((i) =>
            i.id === incidentId ? { ...i, alerts: i.alerts + 1 } : i,
          ),
        })),

      setIncidentStatus: (id, status) =>
        set((s) => ({
          incidents: s.incidents.map((i) =>
            i.id === id ? { ...i, status: status as Incident["status"] } : i,
          ),
        })),
      addIncidentNote: (id, note) =>
        set((s) => ({
          incidents: s.incidents.map((i) =>
            i.id === id
              ? { ...i, notes: [...(i.notes ?? []), { ...note, id: rid(), ts: nowStr() }] }
              : i,
          ),
        })),

      setCaseStatus: (id, status) =>
        set((s) => ({
          ...withCase(s, id, (c) => ({
            ...c,
            status,
            statusHistory: [...c.statusHistory, { status, ts: nowStr() }],
          })),
        })),

      pinEvidence: (id, eventId, justification) =>
        set((s) =>
          withCase(s, id, (c) =>
            c.evidence.some((e) => e.eventId === eventId)
              ? c
              : { ...c, evidence: [...c.evidence, { eventId, justification, pinnedAt: nowStr() }] },
          ),
        ),
      unpinEvidence: (id, eventId) =>
        set((s) =>
          withCase(s, id, (c) => ({
            ...c,
            evidence: c.evidence.filter((e) => e.eventId !== eventId),
          })),
        ),
      tagEvidence: (id, eventId, technique) =>
        set((s) =>
          withCase(s, id, (c) => ({
            ...c,
            evidence: c.evidence.map((e) => (e.eventId === eventId ? { ...e, technique } : e)),
          })),
        ),

      addToTimeline: (id, eventId) =>
        set((s) => ({
          ...withCase(s, id, (c) =>
            c.timeline.includes(eventId) ? c : { ...c, timeline: [...c.timeline, eventId] },
          ),
          globalTimeline: s.globalTimeline.includes(eventId)
            ? s.globalTimeline
            : [...s.globalTimeline, eventId],
        })),
      removeFromTimeline: (id, eventId) =>
        set((s) =>
          withCase(s, id, (c) => ({ ...c, timeline: c.timeline.filter((e) => e !== eventId) })),
        ),

      addCaseNote: (id, body) =>
        set((s) =>
          withCase(s, id, (c) => ({
            ...c,
            notes: [...c.notes, { id: rid(), author: ANALYST, ts: nowStr(), body }],
          })),
        ),

      toggleTechniqueTag: (id, technique) =>
        set((s) =>
          withCase(s, id, (c) => ({
            ...c,
            techniqueTags: c.techniqueTags.includes(technique)
              ? c.techniqueTags.filter((t) => t !== technique)
              : [...c.techniqueTags, technique],
          })),
        ),

      setCaseSummary: (id, summary) => set((s) => withCase(s, id, (c) => ({ ...c, summary }))),
      useHint: (id) => set((s) => withCase(s, id, (c) => ({ ...c, hintsUsed: c.hintsUsed + 1 }))),

      logAction: (id, entry) =>
        set((s) =>
          withCase(s, id, (c) => ({
            ...c,
            actions: [...c.actions, { ...entry, id: rid(), actor: ANALYST, ts: nowStr() }],
          })),
        ),

      submitCase: (id, verdict) =>
        set((s) => {
          const current = s.cases[id] ?? emptyCase();
          const score = scoreCase(id, current, verdict);
          return {
            cases: {
              ...s.cases,
              [id]: {
                ...current,
                verdict,
                status: "closed",
                submittedAt: nowStr(),
                score,
                statusHistory: [
                  ...current.statusHistory,
                  { status: "closed" as CaseStatus, ts: nowStr() },
                ],
              },
            },
            incidents: s.incidents.map((i) => (i.id === id ? { ...i, status: "closed" } : i)),
          };
        }),

      reopenCase: (id, feedback) =>
        set((s) => ({
          ...withCase(s, id, (c) => ({
            ...c,
            status: "reopened",
            statusHistory: [...c.statusHistory, { status: "reopened" as CaseStatus, ts: nowStr() }],
            instructorFeedback: { body: feedback, adjustment: 0, ts: nowStr() },
          })),
          incidents: s.incidents.map((i) => (i.id === id ? { ...i, status: "in-progress" } : i)),
        })),

      toggleIsolate: (host) =>
        set((s) => ({
          endpoints: s.endpoints.map((e) =>
            e.host === host
              ? { ...e, isolated: !e.isolated, status: !e.isolated ? "Isolated" : "Investigating" }
              : e,
          ),
        })),

      submitEmailVerdict: (caseId, verdict, score) =>
        set((s) => ({
          emailCases: {
            ...s.emailCases,
            [caseId]: {
              ...(s.emailCases[caseId] ?? { notes: [] }),
              verdict,
              score,
              submittedAt: nowStr(),
            },
          },
        })),
      addEmailNote: (caseId, note) =>
        set((s) => ({
          emailCases: {
            ...s.emailCases,
            [caseId]: {
              ...(s.emailCases[caseId] ?? { notes: [] }),
              notes: [...(s.emailCases[caseId]?.notes ?? []), { ...note, id: rid(), ts: nowStr() }],
            },
          },
        })),

      setScenarioProgress: (id, pct) =>
        set((s) => ({ scenarioProgress: { ...s.scenarioProgress, [id]: pct } })),

      reset: () => set(seed()),
    }),
    { name: "clickbox:v2", version: 2 },
  ),
);

export const getCase = (s: SocState, id: string): CaseState => s.cases[id] ?? EMPTY_CASE;

// Derived selectors
export const selectOpenAlerts = (s: SocState) =>
  s.alerts.filter((a) => a.status !== "resolved" && a.status !== "closed");
export const selectCriticalOpen = (s: SocState) =>
  s.alerts.filter(
    (a) => a.severity === "critical" && a.status !== "resolved" && a.status !== "closed",
  );
export const selectOpenIncidents = (s: SocState) =>
  s.incidents.filter((i) => i.status !== "resolved" && i.status !== "closed");
export const timelineEventsFrom = (ids: string[]) =>
  ids
    .map((id) => securityEvents.find((e) => e.id === id))
    .filter((e): e is (typeof securityEvents)[number] => Boolean(e))
    .sort((a, b) => a.ts.localeCompare(b.ts));
