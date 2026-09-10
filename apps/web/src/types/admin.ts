// Wire contracts for the platform-admin API (apps/api/src/modules/admin/*). Every endpoint is
// platform_admin-only on the backend (RolesGuard); the frontend nav gating is convenience,
// not the security boundary.

export interface Paged<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ---- Overview -----------------------------------------------------------------

export type UserRoleKey = "student" | "instructor" | "org_admin" | "platform_admin";

export interface PlatformRevenueSummary {
  available: boolean;
  reason: string | null;
  currency: string;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  netRevenueThisMonthCents: number;
  netRevenueThisYearCents: number;
  payingCustomerCount: number;
}

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    byRole: Record<UserRoleKey, number>;
    newToday: number;
    newPast7Days: number;
    newPast30Days: number;
  };
  organizations: { total: number; active: number };
  subscriptions: { active: number | null };
  investigations: { submissions: number; averageScorePercent: number | null };
  revenue: PlatformRevenueSummary;
  generatedAt: string;
}

// ---- Analytics tabs ---------------------------------------------------------

export interface MonthlyPoint {
  month: string;
  label: string;
  count: number;
  cumulative: number;
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newThisMonth: number;
  growth: MonthlyPoint[];
  generatedAt: string;
}

export interface ProductAnalytics {
  scenariosLaunched: number;
  investigationsCompleted: number;
  completionRatePercent: number | null;
  averageScorePercent: number | null;
  mostPopularScenarios: {
    scenarioId: string;
    title: string;
    category: string | null;
    launches: number;
  }[];
  generatedAt: string;
}

export interface OrganizationAnalytics {
  totalOrganizations: number;
  activeOrganizations: number;
  averageMembersPerOrganization: number | null;
  growth: MonthlyPoint[];
  generatedAt: string;
}

// ---- Users ----------------------------------------------------------------

export type UserStatusKey = "active" | "suspended" | "pending_verification";

export interface AdminUserRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: UserStatusKey;
  organization: { id: string; name: string } | null;
  plan: string | null;
  mfaEnabled: boolean;
  emailVerified: boolean;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface AdminUserDetail {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  status: UserStatusKey;
  professionalRole: string | null;
  experienceLevel: string | null;
  mfaEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  organization: { id: string; name: string; status: string } | null;
  performance: {
    investigationsCompleted: number;
    averageScore: number | null;
    bestScore: number | null;
    certificates: number;
  };
  recentActivity: {
    action: string;
    bySelf: boolean;
    occurredAt: string;
    metadata: unknown;
  }[];
}

// ---- Organizations ------------------------------------------------------------

export interface AdminOrgRow {
  id: string;
  name: string;
  industry: string | null;
  status: "active" | "suspended";
  memberCount: number;
  adminCount: number;
  plan: string | null;
  activeSeats: number | null;
  createdAt: string;
}

export interface AdminOrgDetail {
  id: string;
  name: string;
  industry: string | null;
  teamSize: number | null;
  logoDataUrl: string | null;
  status: "active" | "suspended";
  suspendedAt: string | null;
  createdAt: string;
  members: {
    id: string;
    displayName: string;
    email: string;
    role: string;
    status: string;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  cohorts: { id: string; name: string; archived: boolean }[];
  usage: { activeCohorts: number; investigationsCompleted: number };
  recentActivity: { action: string; occurredAt: string; metadata: unknown }[];
}

// ---- Certificates -----------------------------------------------------------

export interface AdminCertificateRow {
  id: string;
  holder: { id: string; displayName: string; email: string };
  type: string;
  issuedAt: string;
  verificationId: string;
  status: "active" | "revoked";
  revokedAt: string | null;
}

// ---- Administrators --------------------------------------------------------

export interface AdministratorRow {
  id: string;
  displayName: string;
  email: string;
  role: "platform_admin";
  status: string;
  mfaEnabled: boolean;
  lastActivityAt: string | null;
  createdAt: string;
}

// ---- Security -------------------------------------------------------------

export interface SecurityOverview {
  mfa: {
    enabled: number;
    disabled: number;
    adoptionPercent: number | null;
    privilegedWithoutMfa: number;
  };
  failedLogins: { last24h: number; last7d: number };
  lockouts: { last7d: number };
  failedMfaChallenges: { last7d: number };
  recentEvents: SecurityEvent[];
  generatedAt: string;
}

export interface SecurityEvent {
  id: string;
  action: string;
  actor: { displayName: string; email: string } | null;
  actorIp: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  occurredAt: string;
}

// ---- Settings ------------------------------------------------------------

export interface PlatformSettings {
  platformName: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  defaultTrialDays: number;
  featureFlags: Record<string, boolean>;
}
