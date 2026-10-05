import { Injectable } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BillingService } from '../../billing/billing.service';
import { toNumber } from '../../../common/dto/decimal';
import type { CustomerAnalyticsQueryDto } from '../dto/customer-analytics-query.dto';
import type { PlatformRevenueSummary } from '../../billing/billing.types';

const ALL_ROLES: UserRole[] = [
  'student',
  'instructor',
  'org_admin',
  'platform_admin',
];

// "Active" = signed in within this window. There is no per-request activity ping, so
// last-login is the honest proxy and the label says so.
const ACTIVE_WINDOW_DAYS = 30;

export interface PlatformOverview {
  users: {
    // Every non-deleted user row, regardless of role. `byRole` breaks it down so it is clear
    // what the headline number includes — platform/org admins are counted here too, since
    // they are real accounts on the platform.
    total: number;
    active: number;
    byRole: Record<UserRole, number>;
    newToday: number;
    newPast7Days: number;
    newPast30Days: number;
  };
  organizations: {
    // Actual Organization rows — not memberships, not org admins.
    total: number;
    active: number;
  };
  subscriptions: {
    // Null until a payment provider is connected — the dashboard shows "—", never 0-as-fact.
    active: number | null;
  };
  investigations: {
    // Sessions submitted for scoring (submitted or already scored).
    submissions: number;
    averageScorePercent: number | null;
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

    const activeSince = new Date(
      now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const notDeleted: Prisma.UserWhereInput = { deletedAt: null };

    const [
      totalUsers,
      activeUsers,
      roleGroups,
      newToday,
      newPast7Days,
      newPast30Days,
      totalOrganizations,
      activeOrganizations,
      submissions,
      scoreAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: notDeleted }),
      this.prisma.user.count({
        where: { ...notDeleted, lastLoginAt: { gte: activeSince } },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: notDeleted,
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: { ...notDeleted, createdAt: { gte: startOfToday } },
      }),
      this.prisma.user.count({
        where: { ...notDeleted, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.user.count({
        where: { ...notDeleted, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'active' } }),
      this.prisma.investigationSession.count({
        where: { status: { in: ['submitted', 'scored'] } },
      }),
      this.prisma.score.aggregate({ _avg: { overallPercent: true } }),
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
        active: activeUsers,
        byRole,
        newToday,
        newPast7Days,
        newPast30Days,
      },
      organizations: { total: totalOrganizations, active: activeOrganizations },
      subscriptions: { active: this.billing.isConfigured() ? 0 : null },
      investigations: {
        submissions,
        averageScorePercent: toNumber(scoreAgg._avg.overallPercent),
      },
      revenue: this.billing.getPlatformRevenueSummary(),
      generatedAt: now.toISOString(),
    };
  }

  // ---- Platform Analytics tabs ---------------------------------------------

  // Registrations bucketed by month for the last 12 months. Fetches only the createdAt column
  // for a bounded window and buckets in memory — fine at this platform's scale, and it avoids
  // a raw date_trunc query. Cumulative total is carried so the chart can show growth, not
  // just per-month bars.
  async getUserAnalytics() {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const activeSince = new Date(
      now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const [rows, priorTotal, totalUsers, activeUsers] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { lt: since } },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, lastLoginAt: { gte: activeSince } },
      }),
    ]);

    const series = monthlySeries(
      rows.map((r) => r.createdAt),
      since,
      now,
      priorTotal,
    );
    return {
      totalUsers,
      activeUsers,
      newThisMonth: series.at(-1)?.count ?? 0,
      growth: series,
      generatedAt: now.toISOString(),
    };
  }

  async getProductAnalytics() {
    const [
      scenariosLaunched,
      investigationsCompleted,
      totalSessions,
      scoreAgg,
      popular,
    ] = await Promise.all([
      this.prisma.investigationSession.count(),
      this.prisma.investigationSession.count({ where: { status: 'scored' } }),
      this.prisma.investigationSession.count(),
      this.prisma.score.aggregate({ _avg: { overallPercent: true } }),
      this.prisma.investigationSession.groupBy({
        by: ['scenarioId'],
        _count: { _all: true },
        orderBy: { _count: { scenarioId: 'desc' } },
        take: 8,
      }),
    ]);

    const scenarioTitles = new Map(
      (
        await this.prisma.attackScenario.findMany({
          where: { id: { in: popular.map((p) => p.scenarioId) } },
          select: { id: true, title: true, category: true },
        })
      ).map((s) => [s.id, s]),
    );

    return {
      scenariosLaunched,
      investigationsCompleted,
      completionRatePercent:
        totalSessions > 0
          ? Math.round((investigationsCompleted / totalSessions) * 1000) / 10
          : null,
      averageScorePercent: toNumber(scoreAgg._avg.overallPercent),
      mostPopularScenarios: popular.map((p) => ({
        scenarioId: p.scenarioId,
        title: scenarioTitles.get(p.scenarioId)?.title ?? 'Unknown',
        category: scenarioTitles.get(p.scenarioId)?.category ?? null,
        launches: p._count._all,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async getOrganizationAnalytics() {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [rows, priorTotal, total, active, memberAgg] = await Promise.all([
      this.prisma.organization.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.organization.count({ where: { createdAt: { lt: since } } }),
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'active' } }),
      this.prisma.user.groupBy({
        by: ['orgId'],
        where: { deletedAt: null, orgId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const memberCounts = memberAgg.map((g) => g._count._all);
    const averageMembers =
      memberCounts.length > 0
        ? Math.round(
            (memberCounts.reduce((s, n) => s + n, 0) / memberCounts.length) *
              10,
          ) / 10
        : null;

    return {
      totalOrganizations: total,
      activeOrganizations: active,
      averageMembersPerOrganization: averageMembers,
      growth: monthlySeries(
        rows.map((r) => r.createdAt),
        since,
        now,
        priorTotal,
      ),
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

export interface MonthlyPoint {
  month: string; // "2026-09"
  label: string; // "Sep"
  count: number; // new that month
  cumulative: number; // running total, including everything before the window
}

// Buckets a list of dates into the calendar months from `since` to `now` inclusive, carrying
// a running cumulative total seeded with `priorTotal` (everything created before the window).
function monthlySeries(
  dates: Date[],
  since: Date,
  now: Date,
  priorTotal: number,
): MonthlyPoint[] {
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const counts = new Map<string, number>();
  for (const d of dates) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);

  const points: MonthlyPoint[] = [];
  let cumulative = priorTotal;
  const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= end) {
    const k = key(cursor);
    const count = counts.get(k) ?? 0;
    cumulative += count;
    points.push({
      month: k,
      label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      count,
      cumulative,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}
