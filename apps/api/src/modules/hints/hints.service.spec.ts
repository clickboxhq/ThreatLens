import { randomUUID } from 'crypto';
import { HintsService } from './hints.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

function buildService(sessionStatus: string) {
  const unlockCreate = jest.fn(async () => ({ hintIndex: 0 }));
  const prisma = {
    hintUnlock: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      create: unlockCreate,
    },
    scenarioVersion: {
      findUniqueOrThrow: jest.fn(async () => ({
        groundTruthDefinition: {
          hints: [
            { text: 'Check the sign-in origin.', unlock_cost_percent: 5 },
          ],
        },
      })),
    },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({
      id: 'session-1',
      status: sessionStatus,
      scenarioVersionId: 'v1',
    })),
  };

  const service = new HintsService(
    prisma as never,
    sessionAccess as never,
    { record: jest.fn(async () => undefined) } as never,
  );
  return { service, unlockCreate };
}

// Hints are session-scoped rather than incident-scoped, but the intent matches every other
// write path: once the session is no longer active, nothing should still be able to move the
// score. A hint carries an unlock cost, so unlocking one after submission would change the
// grade of an investigation that was already finished.
describe('HintsService post-submission immutability', () => {
  it('unlock() refuses once the session is no longer active', async () => {
    const { service, unlockCreate } = buildService('submitted');

    await expect(service.unlock('session-1', 0, USER)).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_NOT_ACTIVE',
    });
    expect(unlockCreate).not.toHaveBeenCalled();
  });

  it('unlock() refuses on an already-scored session', async () => {
    const { service } = buildService('scored');
    await expect(service.unlock('session-1', 0, USER)).rejects.toMatchObject({
      code: 'SESSION_NOT_ACTIVE',
    });
  });

  it('unlock() still works while the investigation is active', async () => {
    const { service, unlockCreate } = buildService('active');
    await service.unlock('session-1', 0, USER);
    expect(unlockCreate).toHaveBeenCalled();
  });
});
