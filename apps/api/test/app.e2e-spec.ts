import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2EApp } from './helpers/e2e-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // §3.7: health/ready are deliberately excluded from the /api/v1 prefix (main.ts) so an
  // external load balancer/orchestrator can probe them without knowing the API's versioning.
  it('GET /health', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  // /ready used to return {status:'ok'} like /health, which is what let it stay green through
  // the 2026-10-04 outage. It now probes each dependency for real — this suite runs against a
  // live Postgres and Redis, so a healthy run is the right expectation here, and the failure
  // paths are covered in health.spec.ts where the dependencies can be made to misbehave.
  it('GET /ready reports each dependency, not a fixed literal', async () => {
    const res = await request(app.getHttpServer()).get('/ready').expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.dependencies.postgres.ok).toBe(true);
    expect(res.body.dependencies.redis.ok).toBe(true);
    // Timings are the early warning: a dependency usually slows before it fails outright.
    expect(typeof res.body.dependencies.redis.ms).toBe('number');
    expect(typeof res.body.checkedAt).toBe('string');
  });
});
