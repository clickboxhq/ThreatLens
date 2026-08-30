import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { SeededRng } from './rng';

// The routine control-plane churn a real directory produces: helpdesk password resets, people
// re-enrolling a phone, joiners and leavers, group changes. It exists so the attacker's own
// directory actions have something to hide in — an "MFA method registered" event is only a
// finding if it is not the only one on the page.

export interface BaselineAuditIdentity {
  id: string;
  displayName: string;
}

interface AuditTemplate {
  category: Prisma.DirectoryAuditEventCreateManyInput['category'];
  action: string;
  /** Self-service actions have no separate actor — the directory records the user themselves. */
  selfService: boolean;
  detail?: () => Prisma.InputJsonValue;
}

const BASELINE_TEMPLATES: AuditTemplate[] = [
  { category: 'credential', action: 'Reset user password', selfService: false },
  { category: 'credential', action: 'Change user password', selfService: true },
  {
    category: 'mfa',
    action: 'User registered security info',
    selfService: true,
  },
  { category: 'mfa', action: 'User deleted security info', selfService: true },
  {
    category: 'group_membership',
    action: 'Add member to group',
    selfService: false,
  },
  {
    category: 'group_membership',
    action: 'Remove member from group',
    selfService: false,
  },
  { category: 'account_lifecycle', action: 'Update user', selfService: false },
  { category: 'mailbox_rule', action: 'Create inbox rule', selfService: true },
];

const HELPDESK_ACTORS = [
  'Helpdesk Automation',
  'Priya Raman (Service Desk)',
  'Directory Sync',
  'Marcus Webb (IT Operations)',
];

const GROUPS = [
  'All Employees',
  'Finance-ReadOnly',
  'VPN-Users',
  'SharePoint-Marketing',
  'Printer-Access-HQ',
];

function internalIp(rng: SeededRng): string {
  return `10.20.${rng.intBetween(1, 40)}.${rng.intBetween(2, 250)}`;
}

/**
 * Baseline directory activity for one identity across the history window. Deliberately mundane
 * and always successful: anything alarming here would be indistinguishable from a scenario's
 * real finding, and the Alert Engine does not read this table, so a "suspicious" baseline event
 * would mislead without ever raising an alert.
 */
export function generateBaselineAuditEvents(
  sessionId: string,
  identity: BaselineAuditIdentity,
  rng: SeededRng,
  historyStart: Date,
  historyEndExclusive: Date,
): Prisma.DirectoryAuditEventCreateManyInput[] {
  const spanMinutes = Math.max(
    1,
    Math.floor(
      (historyEndExclusive.getTime() - historyStart.getTime()) / 60000,
    ),
  );
  const count = rng.intBetween(3, 9);
  const events: Prisma.DirectoryAuditEventCreateManyInput[] = [];

  for (let i = 0; i < count; i++) {
    const template = rng.pick(BASELINE_TEMPLATES);
    const occurredAt = new Date(
      historyStart.getTime() + rng.intBetween(0, spanMinutes) * 60 * 1000,
    );
    const detail: Record<string, unknown> = {};
    if (template.category === 'group_membership')
      detail.group = rng.pick(GROUPS);
    if (template.category === 'mailbox_rule') {
      detail.ruleName = rng.pick([
        'Move newsletters',
        'Flag from manager',
        'Archive receipts',
      ]);
    }

    events.push({
      id: randomUUID(),
      sessionId,
      occurredAt,
      targetIdentityId: identity.id,
      actorIdentityId: template.selfService ? identity.id : null,
      actorDisplayName: template.selfService
        ? identity.displayName
        : rng.pick(HELPDESK_ACTORS),
      category: template.category,
      action: template.action,
      result: 'success',
      detail: Object.keys(detail).length
        ? (detail as Prisma.InputJsonValue)
        : undefined,
      sourceIp: internalIp(rng),
      isGroundTruthEvidence: false,
    });
  }

  return events.sort((a, b) => {
    const at = a.occurredAt as Date;
    const bt = b.occurredAt as Date;
    return at.getTime() - bt.getTime();
  });
}
