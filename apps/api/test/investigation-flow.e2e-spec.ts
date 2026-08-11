import { randomUUID } from 'crypto';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createE2EApp,
  createE2EWorker,
  assertNoForbiddenFields,
  pollUntil,
} from './helpers/e2e-app';
import { EmailVerificationTokenStore } from '../src/modules/auth/email-verification-token.store';

// The full walking-skeleton flow (§2.1–§2.12) driven entirely over HTTP against a real
// Postgres + Redis + BullMQ — signup through a scored session — the one path unit tests
// (every one of which mocks PrismaService directly) structurally cannot cover: that
// migrations actually apply, that AppModule's/WorkerModule's real DI graphs wire up, and that
// the Telemetry Generator → Alert Engine → Scoring Engine job chain actually runs end to end
// across the two separate processes they're now split into (§19.1).
//
// Background jobs run for real here, so this test polls rather than triggers anything —
// the same pattern this project's manual Docker-based live verification has used throughout
// development. Generous timeouts (jest.setTimeout below) reflect that.
jest.setTimeout(120_000);

describe('Investigation flow (e2e)', () => {
  let app: INestApplication;
  let worker: INestApplication;
  let http: ReturnType<typeof request>;

  const email = `e2e-${randomUUID()}@example.com`;
  const password = 'e2e test password 12345';

  let accessToken: string;
  let sessionId: string;
  let incidentId: string;

  beforeAll(async () => {
    app = await createE2EApp();
    worker = await createE2EWorker();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await worker.close();
  });

  it('signs up, verifies email (via direct token-store access — no email provider in dev/CI), and logs in', async () => {
    const signup = await http
      .post('/api/v1/auth/signup')
      .send({ email, password, displayName: 'E2E Test Student' })
      .expect(201);
    expect(signup.body.userId).toBeTruthy();
    expect(signup.body.emailVerificationRequired).toBe(true);

    // The dev/CI environment has no real email provider — AuthService only logs the
    // verification link server-side. Rather than parse logs, mint a token directly through
    // the same Redis-backed store the real request-verification endpoint uses.
    const tokenStore = app.get(EmailVerificationTokenStore);
    const verificationToken = await tokenStore.create(signup.body.userId);
    await http
      .post('/api/v1/auth/email-verification/confirm')
      .send({ token: verificationToken })
      .expect(204);

    const login = await http
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.user.emailVerified).toBe(true);
    accessToken = login.body.accessToken;
  });

  it('creates a session and waits for the real Telemetry Generator + Alert Engine job chain to finish', async () => {
    const scenarios = await http
      .get('/api/v1/scenarios')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assertNoForbiddenFields(scenarios.body);
    const scenario = scenarios.body.find(
      (s: { slug: string }) => s.slug === 'password-spraying-campaign',
    );
    expect(scenario).toBeTruthy();

    const session = await http
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ scenarioId: scenario.id })
      .expect(201);
    sessionId = session.body.id;
    expect(session.body.status).toBe('active');

    const ready = await pollUntil(
      async () =>
        (
          await http
            .get(`/api/v1/sessions/${sessionId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
        ).body,
      (s) => s.ready === true,
      90_000,
    );
    expect(ready.ready).toBe(true);
  });

  it('lists real, rule-generated alerts with no ground-truth fields leaked', async () => {
    const alerts = await http
      .get(`/api/v1/sessions/${sessionId}/alerts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assertNoForbiddenFields(alerts.body);
    expect(alerts.body.length).toBeGreaterThan(0);
    expect(
      alerts.body.some((a: { title: string }) =>
        a.title.includes('Password spray campaign'),
      ),
    ).toBe(true);
  });

  it('investigates: creates an incident, links the alert, pins evidence, adds a note, adds a timeline item', async () => {
    const alerts = await http
      .get(`/api/v1/sessions/${sessionId}/alerts`)
      .set('Authorization', `Bearer ${accessToken}`);
    const sprayAlert = alerts.body.find((a: { title: string }) =>
      a.title.includes('Password spray campaign'),
    );
    expect(sprayAlert).toBeTruthy();

    const incident = await http
      .post(`/api/v1/sessions/${sessionId}/incidents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'E2E Investigation' })
      .expect(201);
    incidentId = incident.body.id;

    await http
      .post(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/alerts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alertIds: [sprayAlert.id] })
      .expect(201);

    const evidence = await http
      .get(`/api/v1/sessions/${sessionId}/alerts/${sprayAlert.id}/evidence`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assertNoForbiddenFields(evidence.body);
    // password-spraying-campaign's rule cites the whole failed-attempt burst plus the
    // eventual success in one alert — well more than the scenario's own min_evidence_items: 2.
    expect(evidence.body.evidence.length).toBeGreaterThanOrEqual(2);

    for (const item of evidence.body.evidence.slice(0, 2)) {
      await http
        .post(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/evidence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          eventTable: item.eventTable,
          eventId: item.eventId,
          justification: 'Part of the observed password spray burst',
        })
        .expect(201);
    }

    await http
      .post(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/notes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ body: 'E2E test note documenting the investigation.' })
      .expect(201);

    const timelineTarget = evidence.body.evidence[0];
    await http
      .post(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/timeline`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        eventTable: timelineTarget.eventTable,
        eventId: timelineTarget.eventId,
      })
      .expect(201);
  });

  it('closes the incident, then rejects further mutation — §2.3 immutability, enforced against a real DB', async () => {
    const techniques = await http
      .get('/api/v1/mitre-techniques')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const requiredTechniqueIds = ['T1110.003', 'T1078']
      .map(
        (slug) =>
          techniques.body.find(
            (t: { techniqueId: string }) => t.techniqueId === slug,
          )?.id,
      )
      .filter(Boolean);
    expect(requiredTechniqueIds).toHaveLength(2);

    await http
      .post(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/close`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        verdict: 'true_positive',
        summary:
          'A password spraying campaign from a single source IP compromised an account.',
        mitreTechniqueIds: requiredTechniqueIds,
      })
      .expect(201);

    const mutationAttempt = await http
      .post(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/notes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ body: 'this must be rejected — the incident is closed' })
      .expect(409);
    expect(mutationAttempt.body.error.code).toBe('INCIDENT_CLOSED');
  });

  it('generates a full incident report (Notes + Evidence + Timeline + Verdict) with no ground-truth leakage', async () => {
    const report = await http
      .get(`/api/v1/sessions/${sessionId}/incidents/${incidentId}/report`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assertNoForbiddenFields(report.body);
    expect(report.body.incident.status).toBe('closed');
    expect(report.body.evidence.length).toBeGreaterThanOrEqual(2);
    expect(report.body.notes.length).toBeGreaterThanOrEqual(1);
    expect(report.body.timeline.length).toBeGreaterThanOrEqual(1);
  });

  it('submits the session and waits for the real Scoring Engine job to produce a score', async () => {
    await http
      .post(`/api/v1/sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ incidentIds: [incidentId] })
      .expect(201);

    const score = await pollUntil<{ status: number; body: unknown } | null>(
      async () => {
        const res = await http
          .get(`/api/v1/sessions/${sessionId}/score`)
          .set('Authorization', `Bearer ${accessToken}`);
        return res.status === 200
          ? { status: res.status, body: res.body }
          : null;
      },
      (result) => result !== null,
      60_000,
    );

    expect(score).not.toBeNull();
    assertNoForbiddenFields(score!.body);
    // Prisma Decimal fields (overallPercent, techniqueAccuracyPercent) serialize over JSON as
    // numeric strings, not numbers — sessions.service.ts passes them through unconverted
    // deliberately (see getScore()), so this is the real wire shape, not a bug to work around.
    const scoreBody = score!.body as {
      overallPercent: string;
      verdictCorrect: boolean;
      techniqueAccuracyPercent: string;
    };
    expect(scoreBody.verdictCorrect).toBe(true);
    expect(Number(scoreBody.overallPercent)).toBeGreaterThan(0);
    expect(Number(scoreBody.techniqueAccuracyPercent)).toBe(100);
  });

  it('reflects the completed session in Progress and Skill Radar', async () => {
    const sessions = await http
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assertNoForbiddenFields(sessions.body);
    const mine = sessions.body.find((s: { id: string }) => s.id === sessionId);
    expect(mine.status).toBe('scored');

    const radar = await http
      .get('/api/v1/sessions/skill-radar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assertNoForbiddenFields(radar.body);
    // T1110.003 and T1078 are both Credential Access / Initial Access tactics — either way,
    // a fully-correct close should show up as 100% somewhere in the radar.
    expect(radar.body.length).toBeGreaterThan(0);
    expect(
      radar.body.some(
        (entry: { hitCount: number; requiredCount: number }) =>
          entry.hitCount === entry.requiredCount,
      ),
    ).toBe(true);
  }, 30_000);
});
