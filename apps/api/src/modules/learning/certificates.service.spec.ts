import { CertificatesService } from './certificates.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

/**
 * A course with two paths (threshold 70). Scenarios s1,s2 in path A; s3 in path B.
 * "Complete the Career Track" = best score >= 70 on s1, s2 AND s3.
 */
function buildService(
  opts: {
    bestScores?: Record<string, number>;
    existingCert?: boolean;
  } = {},
) {
  const created: Array<Record<string, unknown>> = [];
  const course = {
    id: 'course-1',
    title: 'SOC Analyst Fundamentals',
    learningPaths: [
      {
        passThresholdPercent: 70,
        scenarios: [
          { scenarioId: 's1', scenario: { title: 'S1' } },
          { scenarioId: 's2', scenario: { title: 'S2' } },
        ],
      },
      {
        passThresholdPercent: 70,
        scenarios: [{ scenarioId: 's3', scenario: { title: 'S3' } }],
      },
    ],
  };
  const sessions = Object.entries(opts.bestScores ?? {}).map(
    ([scenarioId, percent]) => ({
      scenarioId,
      score: { overallPercent: percent },
    }),
  );

  const prisma = {
    learningPathScenario: {
      findMany: jest.fn(async () => [
        { learningPath: { courseId: 'course-1' } },
      ]),
    },
    course: {
      findUniqueOrThrow: jest.fn(async () => course),
      findMany: jest.fn(async () => [course]),
    },
    certificate: {
      findUnique: jest.fn(async () =>
        opts.existingCert ? { id: 'c0' } : null,
      ),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return args.data;
      }),
    },
    investigationSession: { findMany: jest.fn(async () => sessions) },
  };
  const notifications = { create: jest.fn(async () => undefined) };
  const config = { get: jest.fn(() => 'https://threatlensapp.com') };

  const service = new CertificatesService(
    prisma as never,
    notifications as never,
    config as never,
  );
  return { service, prisma, notifications, created };
}

const user = (id = 'u1'): AuthenticatedUser => ({ id }) as AuthenticatedUser;

describe('CertificatesService — issuance', () => {
  it('does NOT issue a certificate when the track is incomplete', async () => {
    const { service, created, notifications } = buildService({
      bestScores: { s1: 90, s2: 90 }, // s3 missing
    });
    await service.checkAndIssueForScenario('u1', 's1');
    expect(created).toHaveLength(0);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('does NOT issue when a scenario is below the pass threshold', async () => {
    const { service, created } = buildService({
      bestScores: { s1: 90, s2: 69, s3: 90 },
    });
    await service.checkAndIssueForScenario('u1', 's2');
    expect(created).toHaveLength(0);
  });

  it('issues one certificate — with a TL- public id and a score snapshot — once every scenario passes', async () => {
    const { service, created, notifications } = buildService({
      bestScores: { s1: 88, s2: 74, s3: 91 },
    });
    await service.checkAndIssueForScenario('u1', 's3');
    expect(created).toHaveLength(1);
    expect(created[0].userId).toBe('u1');
    expect(created[0].courseId).toBe('course-1');
    expect(created[0].publicId).toMatch(/^TL-\d{4}-[A-Z0-9]{8}$/);
    expect(Object.keys(created[0].scoreSnapshot as object).sort()).toEqual([
      's1',
      's2',
      's3',
    ]);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'certificate_issued' }),
    );
  });

  it('is idempotent — never issues a second certificate for the same course', async () => {
    const { service, created } = buildService({
      bestScores: { s1: 88, s2: 88, s3: 88 },
      existingCert: true,
    });
    await service.checkAndIssueForScenario('u1', 's1');
    expect(created).toHaveLength(0);
  });
});

describe('CertificatesService — verification', () => {
  it('verify() throws a safe 404 for an unknown id — no internals leak', async () => {
    const { service, prisma } = buildService();
    prisma.certificate.findFirst = jest.fn(async () => null);
    await expect(service.verify('TL-2026-NOPENOPE')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('getMine() 404s when the certificate belongs to a different user', async () => {
    const { service, prisma } = buildService();
    prisma.certificate.findFirst = jest.fn(async () => ({
      userId: 'someone-else',
      publicId: 'TL-2026-AAAAAAAA',
      issuedAt: new Date(),
      revokedAt: null,
      user: { displayName: 'X', firstName: null, lastName: null },
      course: { title: 'SOC Analyst Fundamentals' },
      learningPath: null,
    }));
    await expect(
      service.getMine(user('u1'), 'TL-2026-AAAAAAAA'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
