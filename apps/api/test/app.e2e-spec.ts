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

  it('GET /ready', () => {
    return request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
