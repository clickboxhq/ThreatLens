import { NotificationsService } from './notifications.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

function buildUser(
  overrides: Partial<Record<string, unknown>> = {},
): AuthenticatedUser {
  return {
    id: 'user-1',
    role: 'student',
    orgId: null,
    ...overrides,
  } as AuthenticatedUser;
}

function buildService(
  options: {
    notifications?: Array<Record<string, unknown>>;
  } = {},
) {
  const prisma = {
    notification: {
      create: jest.fn(async () => undefined),
      findMany: jest.fn(async () => options.notifications ?? []),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async () => undefined),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  const service = new NotificationsService(prisma as never);
  return { service, prisma };
}

describe('NotificationsService.create', () => {
  it('writes a row with the given category/title/body/link', async () => {
    const { service, prisma } = buildService();

    await service.create({
      userId: 'user-1',
      category: 'score_available',
      title: 'Investigation scored',
      body: 'Impossible Travel scored 85%.',
      link: '/app/cases/session-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        category: 'score_available',
        title: 'Investigation scored',
        body: 'Impossible Travel scored 85%.',
        link: '/app/cases/session-1',
      },
    });
  });

  it('defaults link to null when omitted', async () => {
    const { service, prisma } = buildService();

    await service.create({
      userId: 'user-1',
      category: 'certificate_issued',
      title: 'Certificate issued',
      body: 'x',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ link: null }),
      }),
    );
  });
});

describe('NotificationsService.listMine', () => {
  it("returns only the caller's notifications, most recent first (via the query itself)", async () => {
    const { service, prisma } = buildService({
      notifications: [
        {
          id: 'n-1',
          category: 'score_available',
          title: 'Investigation scored',
          body: 'x',
          link: null,
          read: false,
          createdAt: new Date('2026-08-29T00:00:00Z'),
        },
      ],
    });

    const result = await service.listMine(buildUser());

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(result).toEqual([
      {
        id: 'n-1',
        category: 'score_available',
        title: 'Investigation scored',
        body: 'x',
        link: null,
        read: false,
        createdAt: new Date('2026-08-29T00:00:00Z'),
      },
    ]);
  });
});

describe('NotificationsService.markAsRead', () => {
  it('404s on a notification that does not exist', async () => {
    const { service } = buildService();

    await expect(
      service.markAsRead(buildUser(), 'missing'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it("404s on someone else's notification rather than leaking its existence", async () => {
    const { service, prisma } = buildService();
    prisma.notification.findUnique.mockResolvedValueOnce({
      id: 'n-1',
      userId: 'someone-else',
      read: false,
    });

    await expect(service.markAsRead(buildUser(), 'n-1')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('marks the caller’s own unread notification as read', async () => {
    const { service, prisma } = buildService();
    prisma.notification.findUnique.mockResolvedValueOnce({
      id: 'n-1',
      userId: 'user-1',
      read: false,
    });

    await service.markAsRead(buildUser(), 'n-1');

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { read: true },
    });
  });

  it('is a no-op on an already-read notification', async () => {
    const { service, prisma } = buildService();
    prisma.notification.findUnique.mockResolvedValueOnce({
      id: 'n-1',
      userId: 'user-1',
      read: true,
    });

    await service.markAsRead(buildUser(), 'n-1');

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.markAllAsRead', () => {
  it("only updates the caller's own unread notifications", async () => {
    const { service, prisma } = buildService();

    await service.markAllAsRead(buildUser());

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
      data: { read: true },
    });
  });
});
