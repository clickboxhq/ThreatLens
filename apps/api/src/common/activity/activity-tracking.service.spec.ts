import { randomUUID } from 'crypto';
import { ActivityTrackingService } from './activity-tracking.service';

function buildService() {
  const prisma = {
    user: {
      update: jest.fn(async () => undefined),
    },
  };
  const service = new ActivityTrackingService(prisma as never);
  return { service, prisma };
}

describe('ActivityTrackingService.touch', () => {
  it('writes lastMeaningfulActivityAt for the given user', async () => {
    const { service, prisma } = buildService();
    const userId = randomUUID();

    await service.touch(userId);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { lastMeaningfulActivityAt: expect.any(Date) },
    });
  });

  it('never throws, even when the write fails — a presence-tracking failure must never affect the real request or job it is attached to', async () => {
    const prisma = {
      user: {
        update: jest.fn(async () => {
          throw new Error('db unavailable');
        }),
      },
    };
    const service = new ActivityTrackingService(prisma as never);

    await expect(service.touch(randomUUID())).resolves.toBeUndefined();
  });
});
