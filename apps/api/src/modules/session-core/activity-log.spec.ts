import { summariseAction, summariseActivity } from './activity-log';
import type { InvestigationActionType } from '@prisma/client';

const act = (actionType: InvestigationActionType, targetId = 'a') => ({
  actionType,
  targetId,
});

describe('activity log summaries', () => {
  it('names what was opened when the label resolved', () => {
    expect(summariseAction('view_entity', 'identity', 'Casey Kowalski')).toBe(
      'Opened identity Casey Kowalski',
    );
    expect(
      summariseAction('pin_evidence', 'email_message', 'URGENT: Wire Transfer'),
    ).toBe('Pinned email URGENT: Wire Transfer');
  });

  it('still reads as a sentence when the label could not be resolved', () => {
    // Telemetry is per-session and can be gone; the line must not degrade to "Opened null".
    expect(summariseAction('view_entity', 'device', null)).toBe(
      'Opened the device',
    );
  });

  it('does not repeat the target for actions whose verb already names it', () => {
    expect(summariseAction('search', 'session', null)).toBe(
      'Searched telemetry',
    );
    expect(summariseAction('request_hint', 'hint', null)).toBe(
      'Unlocked a hint',
    );
  });

  it('falls back rather than throwing on an unmapped target type', () => {
    expect(summariseAction('view_entity', 'some_new_thing', null)).toBe(
      'Opened the some new thing',
    );
  });

  it('counts distinct entities opened, not repeat visits', () => {
    // Revisiting the same identity four times is one entity examined, not four.
    const summary = summariseActivity([
      act('view_entity', 'id-1'),
      act('view_entity', 'id-1'),
      act('view_entity', 'id-1'),
      act('view_entity', 'id-2'),
    ]);
    expect(summary.entitiesOpened).toBe(2);
    expect(summary.totalActions).toBe(4);
  });

  it('separates response actions from investigative ones', () => {
    const summary = summariseActivity([
      act('view_entity'),
      act('pin_evidence'),
      act('isolate_device'),
      act('revoke_tokens'),
    ]);
    expect(summary.responseActionsTaken).toBe(2);
    expect(summary.evidencePinned).toBe(1);
  });

  it('reports zeroes for an investigation with no activity yet', () => {
    const summary = summariseActivity([]);
    expect(summary).toEqual({
      totalActions: 0,
      entitiesOpened: 0,
      evidencePinned: 0,
      searchesRun: 0,
      hintsUnlocked: 0,
      responseActionsTaken: 0,
    });
  });

  it('has a verb for every action type the schema can record', () => {
    // A missing verb would silently render "Acted on" for a real action.
    const ALL: InvestigationActionType[] = [
      'view_entity',
      'search',
      'add_to_timeline',
      'pin_evidence',
      'isolate_device',
      'disable_account',
      'block_sender',
      'dismiss_alert',
      'escalate_to_incident',
      'submit_verdict',
      'request_hint',
      'force_password_reset',
      'revoke_tokens',
      'block_ip',
      'view_threat_intel',
    ];
    for (const a of ALL) {
      expect(summariseAction(a, 'identity', 'X')).not.toContain('Acted on');
    }
  });

  // Evidence and timeline record the event *table* they are keyed by, which is plural, while
  // view_entity records a singular entity name. A missed plural rendered as "Pinned as
  // evidence email messages URGENT: ..." in production before this was caught.
  it('maps the plural event-table names evidence and timeline actually record', () => {
    expect(
      summariseAction('pin_evidence', 'email_messages', 'URGENT: Wire'),
    ).toBe('Pinned email URGENT: Wire');
    expect(summariseAction('pin_evidence', 'sign_in_events', null)).toBe(
      'Pinned the sign-in',
    );
  });

  it('says where a timelined item went', () => {
    expect(
      summariseAction('add_to_timeline', 'email_messages', 'URGENT: Wire'),
    ).toBe('Added email URGENT: Wire to the timeline');
  });
});
