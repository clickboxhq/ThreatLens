import type { InvestigationActionType } from '@prisma/client';

// Recommendation 05 from the SOC-tool research. Sentinel and Defender both keep a per-incident
// activity log of what the analyst actually did, and it serves two distinct purposes: during
// the investigation it answers "have I already looked at this?", and afterwards it is the
// record of how a conclusion was reached.
//
// For a teaching product the second purpose is the more valuable one. A learner who scored
// badly can see that they pinned two things and never opened the device, which is a far more
// useful lesson than a percentage. The data has been written to investigation_actions since
// the beginning and has never once been shown to the person who generated it.

export interface ActivityEntry {
  id: string;
  actionType: InvestigationActionType;
  targetType: string;
  targetId: string;
  /** Human-readable name of what was acted on, where it could be resolved. */
  targetLabel: string | null;
  occurredAt: Date;
  /** One line describing the action, written for the person who performed it. */
  summary: string;
}

// Phrased in the second person and in the past tense: this is a record of what you did, not a
// system log of events that happened to you.
const ACTION_VERBS: Record<InvestigationActionType, string> = {
  view_entity: 'Opened',
  search: 'Searched telemetry',
  add_to_timeline: 'Added to the timeline',
  pin_evidence: 'Pinned as evidence',
  isolate_device: 'Isolated',
  disable_account: 'Disabled',
  block_sender: 'Blocked sender',
  dismiss_alert: 'Dismissed alert',
  escalate_to_incident: 'Escalated to an incident',
  submit_verdict: 'Submitted a verdict',
  request_hint: 'Unlocked a hint',
  force_password_reset: 'Forced a password reset',
  revoke_tokens: 'Revoked tokens',
  block_ip: 'Blocked an IP address',
  view_threat_intel: 'Looked up an indicator',
};

const TARGET_NOUNS: Record<string, string> = {
  email_message: 'email',
  identity: 'identity',
  device: 'device',
  alert: 'alert',
  incident: 'incident',
  session: 'session',
  hint: 'hint',
  threat_intel_indicator: 'indicator',
};

export function summariseAction(
  actionType: InvestigationActionType,
  targetType: string,
  targetLabel: string | null,
): string {
  const verb = ACTION_VERBS[actionType] ?? 'Acted on';
  const noun = TARGET_NOUNS[targetType] ?? targetType.replace(/_/g, ' ');

  // Actions whose verb already names what was acted on read badly with the noun repeated
  // ("Searched telemetry the session"), so they stand alone.
  if (
    actionType === 'search' ||
    actionType === 'submit_verdict' ||
    actionType === 'request_hint'
  ) {
    return verb;
  }

  return targetLabel ? `${verb} ${noun} ${targetLabel}` : `${verb} the ${noun}`;
}

export interface ActivitySummary {
  totalActions: number;
  entitiesOpened: number;
  evidencePinned: number;
  searchesRun: number;
  hintsUnlocked: number;
  responseActionsTaken: number;
}

const RESPONSE_ACTIONS = new Set<InvestigationActionType>([
  'isolate_device',
  'disable_account',
  'block_sender',
  'force_password_reset',
  'revoke_tokens',
  'block_ip',
]);

/**
 * A short shape-of-the-investigation summary. Counts only — deliberately no judgement about
 * whether the numbers are good, because "enough" depends entirely on the case. Three pins can
 * be thorough work on a simple alert or a badly rushed job on a complex one, and the product
 * has no business guessing which.
 */
export function summariseActivity(
  actions: { actionType: InvestigationActionType; targetId: string }[],
): ActivitySummary {
  const openedIds = new Set(
    actions
      .filter((a) => a.actionType === 'view_entity')
      .map((a) => a.targetId),
  );

  return {
    totalActions: actions.length,
    entitiesOpened: openedIds.size,
    evidencePinned: actions.filter((a) => a.actionType === 'pin_evidence')
      .length,
    searchesRun: actions.filter((a) => a.actionType === 'search').length,
    hintsUnlocked: actions.filter((a) => a.actionType === 'request_hint')
      .length,
    responseActionsTaken: actions.filter((a) =>
      RESPONSE_ACTIONS.has(a.actionType),
    ).length,
  };
}
