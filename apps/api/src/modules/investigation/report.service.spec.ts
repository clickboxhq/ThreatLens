import { randomUUID } from 'crypto';
import { ReportService } from './report.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

// §2.14's Reports list — every closed incident the Student has ever produced a final report
// for, across every session they've run.
describe('ReportService.listMine', () => {
  it('returns [] when the Student has no closed incidents', async () => {
    const prisma = { incident: { findMany: jest.fn(async () => []) } };
    const service = new ReportService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await expect(service.listMine(USER)).resolves.toEqual([]);
  });

  it('maps each closed incident with its scenario/session context', async () => {
    const closedAt = new Date('2026-08-01T00:00:00Z');
    const prisma = {
      incident: {
        findMany: jest.fn(async (args: { where: unknown }) => {
          expect(args.where).toEqual({
            status: 'closed',
            session: { userId: USER.id },
          });
          return [
            {
              id: 'incident-1',
              sessionId: 'session-1',
              title: 'Suspicious sign-in',
              verdict: 'true_positive',
              closedAt,
              session: { scenario: { title: 'Impossible Travel' } },
            },
          ];
        }),
      },
    };
    const service = new ReportService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(service.listMine(USER)).resolves.toEqual([
      {
        sessionId: 'session-1',
        incidentId: 'incident-1',
        incidentTitle: 'Suspicious sign-in',
        scenarioTitle: 'Impossible Travel',
        verdict: 'true_positive',
        closedAt,
      },
    ]);
  });
});
