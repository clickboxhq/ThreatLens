import { Injectable } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BillingService } from '../../billing/billing.service';
import type { CustomerAnalyticsQueryDto } from '../dto/customer-analytics-query.dto';
import type { PlatformRevenueSummary } from '../../billing/billing.types';

const ALL_ROLES: UserRole[] = [
  'student',
  'instructor',
  'org_admin',
  'platform_admin',
];

export interface PlatformOverview {
  users: {
    // Every non-deleted user row, regardless of role. `byRole` breaks it down so it is clear
    // what the headline number includes — platform/org admins are counted here too, since
    // they are real accounts on the platform.
    total: number;
    byRole: Record<UserRole, number>;
    newToday: number;
    newPast7Days: number;
    newPast30Days: number;
  };
  organizations: {
    // Actual Organization rows — not memberships, not org admins.
    total: number;
  };
  revenue: PlatformRevenueSummary;
  generatedAt: string;
}

export interface CustomerRow {
  customerId: string;
  name: string;
  type: 'individual' | 'organization';
  memberCount: number | null;
  plan: string | null;
  subscriptionStatus: string | null;
  totalRevenueCents: number;
  currency: string;
  lastPaymentAt: string | null;
  createdAt: string;
}

export interface CustomerPage {
  data: CustomerRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  // Surfaced so the UI can show "revenue unavailable" state honestly rather than reading the
  // zeros as real.
  revenueAvailable: boolean;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  // §16.14 — platform-wide business metrics. Gated to `platform_admin` at the controller
  // (RolesGuard); an org_admin hitting this gets a 403, not their own org's slice.
  async getOverview(): Promise<PlatformOverview> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeUser: Prisma.UserWhereInput = { deletedAt: null };

    const [
      totalUsers,
      roleGroups,
      newToday,
      newPast7Days,
      newPast30Days,
      totalOrganizations,
    ] = await Promise.all([
      this.prisma.user.count({ where: activeUser }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: activeUser,
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: { ...activeUser, createdAt: { gte: startOfToday } },
      }),
      this.prisma.user.count({
        where: { ...activeUser, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.user.count({
        where: { ...activeUser, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.organization.count(),
    ]);

    const byRole = ALL_ROLES.reduce(
      (acc, role) => {
        acc[role] = 0;
        return acc;
      },
      {} as Record<UserRole, number>,
    );
    for (const group of roleGroups) {
      byRole[group.role] = group._count._all;
    }

    return {
      users: {
        total: totalUsers,
        byRole,
        newToday,
        newPast7Days,
        newPast30Days,
      },
      organizations: { total: totalOrganizations },
      revenue: this.billing.getPlatformRevenueSummary(),
      generatedAt: now.toISOString(),
    };
  }

  // Revenue by billing customer. A customer is an Organization (its members roll up to it) or
  // an individual user with no organization — org members are never billed individually. The
  // list is "organizations first, then individuals", each newest-first by default, and paged
  // across that concatenation. Revenue columns come from the billing seam (all zero / null
  // until a provider is connected).
  async getCustomers(query: CustomerAnalyticsQueryDto): Promise<CustomerPage> {
    const { page, limit, search, type, sort } = query;
    const offset = (page - 1) * limit;

    const orgWhere = this.orgWhere(search);
    const individualWhere = this.individualWhere(search);

    const includeOrgs = type !== 'individual';
    const includeIndividuals = type !== 'organization';

    const [orgTotal, individualTotal] = await Promise.all([
      includeOrgs ? this.prisma.organization.count({ where: orgWhere }) : 0,
      includeIndividuals
        ? this.prisma.user.count({ where: individualWhere })
        : 0,
    ]);
    const total = orgTotal + individualTotal;

    const orderBy = this.orderBy(sort);

    const orgSkip = Math.min(offset, orgTotal);
    const orgTake = Math.max(0, Math.min(limit, orgTotal - orgSkip));
    const orgs =
      includeOrgs && orgTake > 0
        ? await this.prisma.organization.findMany({
            where: orgWhere,
            orderBy: orderBy.org,
            skip: orgSkip,
            take: orgTake,
            select: {
              id: true,
              name: true,
              createdAt: true,
              _count: { select: { users: true } },
            },
          })
        : [];

    const individualSkip = Math.max(0, offset - orgTotal);
    const individualTake = limit - orgs.length;
    const individuals =
      includeIndividuals && individualTake > 0
        ? await this.prisma.user.findMany({
            where: individualWhere,
            orderBy: orderBy.user,
            skip: individualSkip,
            take: individualTake,
            select: {
              id: true,
              displayName: true,
              email: true,
              createdAt: true,
            },
          })
        : [];

    const customerIds = [
      ...orgs.map((o) => o.id),
      ...individuals.map((u) => u.id),
    ];
    const revenueByCustomer = this.billing.getRevenueByCustomer(customerIds);

    const rowFor = (
      id: string,
      name: string,
      customerType: 'individual' | 'organization',
      createdAt: Date,
      memberCount: number | null,
    ): CustomerRow => {
      const revenue = revenueByCustomer.get(id);
      return {
        customerId: id,
        name,
        type: customerType,
        memberCount,
        plan: revenue?.plan ?? null,
        subscriptionStatus: revenue?.subscriptionStatus ?? null,
        totalRevenueCents: revenue?.netRevenueCents ?? 0,
        currency: revenue?.currency ?? 'USD',
        lastPaymentAt: revenue?.lastPaymentAt ?? null,
        createdAt: createdAt.toISOString(),
      };
    };

    const data: CustomerRow[] = [
      ...orgs.map((o) =>
        rowFor(o.id, o.name, 'organization', o.createdAt, o._count.users),
      ),
      ...individuals.map((u) =>
        rowFor(u.id, u.displayName || u.email, 'individual', u.createdAt, null),
      ),
    ];

    return {
      data,
      page,
      limit,
      total,
      hasMore: offset + data.length < total,
      revenueAvailable: this.billing.isConfigured(),
    };
  }

  private orgWhere(search?: string): Prisma.OrganizationWhereInput {
    if (!search) return {};
    return { name: { contains: search, mode: 'insensitive' } };
  }

  private individualWhere(search?: string): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = {
      deletedAt: null,
      orgId: null,
      // Platform admins are staff, not billing customers.
      role: { not: 'platform_admin' },
    };
    if (!search) return base;
    return {
      ...base,
      OR: [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  private orderBy(sort: 'newest' | 'oldest' | 'name'): {
    org: Prisma.OrganizationOrderByWithRelationInput;
    user: Prisma.UserOrderByWithRelationInput;
  } {
    switch (sort) {
      case 'oldest':
        return { org: { createdAt: 'asc' }, user: { createdAt: 'asc' } };
      case 'name':
        return { org: { name: 'asc' }, user: { displayName: 'asc' } };
      case 'newest':
      default:
        return { org: { createdAt: 'desc' }, user: { createdAt: 'desc' } };
    }
  }
}
