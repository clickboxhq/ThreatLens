import { AdminOrganizationsService } from './admin-organizations.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

const ADMIN = { id: 'admin-1', role: 'platform_admin' } as AuthenticatedUser;

function build(org: { id: string; status: string; deletedAt?: Date | null }) {
  const orgUpdate = jest.fn().mockResolvedValue({});
  const userUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
  const refreshUpdateMany = jest.fn().mockResolvedValue({ count: 5 });

  const prisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue(org),
      findFirst: jest.fn().mockResolvedValue(org),
      update: orgUpdate,
    },
    user: { updateMany: userUpdateMany },
    refreshToken: { updateMany: refreshUpdateMany },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const auditLog = { record: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new AdminOrganizationsService(prisma, auditLog as never),
    orgUpdate,
    userUpdateMany,
    refreshUpdateMany,
    auditLog,
  };
}

describe('AdminOrganizationsService.setStatus', () => {
  // Suspending an organisation blocked new sign-ins but left everyone already signed in
  // working until their access token expired — up to fifteen minutes of an org that is
  // supposed to be cut off. Suspending a single user already revoked sessions immediately,
  // so the same admin surface gave two different guarantees.
  it('ends the members sessions when suspending', async () => {
    const { service, userUpdateMany, refreshUpdateMany } = build({
      id: 'org-1',
      status: 'active',
    });

    await service.setStatus(ADMIN, 'org-1', 'suspended');

    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-1', deletedAt: null },
        data: { sessionVersion: { increment: 1 } },
      }),
    );
    expect(refreshUpdateMany).toHaveBeenCalled();
  });

  it('does not log anybody out when reactivating', async () => {
    // They are already signed out. Bumping again would eject anyone who had since returned.
    const { service, userUpdateMany, refreshUpdateMany } = build({
      id: 'org-1',
      status: 'suspended',
    });

    await service.setStatus(ADMIN, 'org-1', 'active');

    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(refreshUpdateMany).not.toHaveBeenCalled();
  });

  it('does nothing at all when the status is unchanged', async () => {
    const { service, orgUpdate, userUpdateMany } = build({
      id: 'org-1',
      status: 'suspended',
    });

    await service.setStatus(ADMIN, 'org-1', 'suspended');

    expect(orgUpdate).not.toHaveBeenCalled();
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it('records the suspension in the audit log', async () => {
    const { service, auditLog } = build({ id: 'org-1', status: 'active' });
    await service.setStatus(ADMIN, 'org-1', 'suspended');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'org-1', actorUserId: 'admin-1' }),
    );
  });
});
