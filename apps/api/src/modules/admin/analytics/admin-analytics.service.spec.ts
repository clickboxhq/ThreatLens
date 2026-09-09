import { AdminAnalyticsService } from './admin-analytics.service';
import { BillingService } from '../../billing/billing.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { CustomerAnalyticsQueryDto } from '../dto/customer-analytics-query.dto';

function query(
  overrides: Partial<CustomerAnalyticsQueryDto> = {},
): CustomerAnalyticsQueryDto {
  return { page: 1, limit: 25, sort: 'newest', ...overrides };
}

function overviewPrisma(overrides: {
  userGroupBy?: unknown[];
  userCount?: number;
  orgCount?: number;
}) {
  return {
    user: {
      count: jest.fn().mockResolvedValue(overrides.userCount ?? 0),
      groupBy: jest.fn().mockResolvedValue(overrides.userGroupBy ?? []),
    },
    organization: {
      count: jest.fn().mockResolvedValue(overrides.orgCount ?? 0),
    },
    investigationSession: { count: jest.fn().mockResolvedValue(0) },
    score: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _avg: { overallPercent: null } }),
    },
  } as unknown as PrismaService;
}

describe('AdminAnalyticsService.getOverview', () => {
  it('maps grouped role counts onto every role, zero-filling the absent ones', async () => {
    const prisma = overviewPrisma({
      orgCount: 3,
      userGroupBy: [
        { role: 'student', _count: { _all: 7 } },
        { role: 'platform_admin', _count: { _all: 1 } },
      ],
    });

    const service = new AdminAnalyticsService(prisma, new BillingService());
    const overview = await service.getOverview();

    expect(overview.users.byRole).toEqual({
      student: 7,
      instructor: 0,
      org_admin: 0,
      platform_admin: 1,
    });
    expect(overview.organizations.total).toBe(3);
  });

  it('reports revenue and subscriptions as unavailable while there is no payment provider', async () => {
    const service = new AdminAnalyticsService(
      overviewPrisma({}),
      new BillingService(),
    );
    const overview = await service.getOverview();

    expect(overview.revenue.available).toBe(false);
    expect(overview.revenue.netRevenueCents).toBe(0);
    expect(overview.subscriptions.active).toBeNull();
  });
});

describe('AdminAnalyticsService.getCustomers', () => {
  // 3 organizations, 4 individuals -> a 7-row "orgs first, then individuals" concatenation.
  function buildService() {
    const orgs = [
      {
        id: 'o1',
        name: 'Org One',
        createdAt: new Date('2026-03-01'),
        _count: { users: 5 },
      },
      {
        id: 'o2',
        name: 'Org Two',
        createdAt: new Date('2026-02-01'),
        _count: { users: 2 },
      },
      {
        id: 'o3',
        name: 'Org Three',
        createdAt: new Date('2026-01-01'),
        _count: { users: 9 },
      },
    ];
    const individuals = [
      {
        id: 'u1',
        displayName: 'Ann',
        email: 'ann@example.com',
        createdAt: new Date('2026-04-01'),
      },
      {
        id: 'u2',
        displayName: 'Bo',
        email: 'bo@example.com',
        createdAt: new Date('2026-03-15'),
      },
      {
        id: 'u3',
        displayName: 'Cy',
        email: 'cy@example.com',
        createdAt: new Date('2026-03-10'),
      },
      {
        id: 'u4',
        displayName: 'Di',
        email: 'di@example.com',
        createdAt: new Date('2026-03-05'),
      },
    ];

    const prisma = {
      organization: {
        count: jest.fn().mockResolvedValue(orgs.length),
        findMany: jest.fn(({ skip = 0, take = 0 }) =>
          Promise.resolve(orgs.slice(skip, skip + take)),
        ),
      },
      user: {
        count: jest.fn().mockResolvedValue(individuals.length),
        findMany: jest.fn(({ skip = 0, take = 0 }) =>
          Promise.resolve(individuals.slice(skip, skip + take)),
        ),
      },
    } as unknown as PrismaService;

    return new AdminAnalyticsService(prisma, new BillingService());
  }

  it('returns organizations before individuals on the first page', async () => {
    const service = buildService();
    const result = await service.getCustomers(query({ page: 1, limit: 4 }));

    expect(result.total).toBe(7);
    expect(result.data.map((r) => r.customerId)).toEqual([
      'o1',
      'o2',
      'o3',
      'u1',
    ]);
    expect(result.data[0].type).toBe('organization');
    expect(result.data[3].type).toBe('individual');
    expect(result.hasMore).toBe(true);
  });

  it('continues the same concatenation onto the second page', async () => {
    const service = buildService();
    const result = await service.getCustomers(query({ page: 2, limit: 4 }));

    expect(result.data.map((r) => r.customerId)).toEqual(['u2', 'u3', 'u4']);
    expect(result.hasMore).toBe(false);
  });

  it('crosses the org/individual boundary within one page', async () => {
    const service = buildService();
    const result = await service.getCustomers(query({ page: 1, limit: 5 }));

    expect(result.data.map((r) => r.customerId)).toEqual([
      'o1',
      'o2',
      'o3',
      'u1',
      'u2',
    ]);
  });

  it('filters to individuals only', async () => {
    const service = buildService();
    const result = await service.getCustomers(
      query({ type: 'individual', limit: 10 }),
    );

    expect(result.total).toBe(4);
    expect(result.data.every((r) => r.type === 'individual')).toBe(true);
  });

  it('carries the member count for organizations and null for individuals', async () => {
    const service = buildService();
    const result = await service.getCustomers(query({ limit: 4 }));

    expect(result.data.find((r) => r.customerId === 'o1')?.memberCount).toBe(5);
    expect(
      result.data.find((r) => r.customerId === 'u1')?.memberCount,
    ).toBeNull();
  });

  it('shows zero revenue and an unavailable flag while billing is not connected', async () => {
    const service = buildService();
    const result = await service.getCustomers(query({ limit: 4 }));

    expect(result.revenueAvailable).toBe(false);
    expect(result.data.every((r) => r.totalRevenueCents === 0)).toBe(true);
    expect(result.data.every((r) => r.plan === null)).toBe(true);
  });
});
