import { PrismaClient } from '@prisma/client';

/**
 * Read-only review of the audit log for signs of credential misuse.
 *
 * Written for the October 2026 Railway incident, when the provider advised revoking every
 * environment variable it held — which for ThreatLens is the database URL, the JWT signing
 * secret, the Redis URL and the Resend key. A leaked database URL or JWT secret leaves no
 * trace anywhere outside this table, so this is the only place it would show.
 *
 *   railway ssh --service api -- npx ts-node prisma/audit-sweep.ts
 *   railway ssh --service api -- npx ts-node prisma/audit-sweep.ts 60   # days
 *
 * Reads and prints only. It is safe to run at any time, and is deliberately not an endpoint:
 * the output names accounts and IP addresses, so it belongs behind the same shell boundary as
 * granting the admin role.
 */

// Actions that are either privileged or a step in taking over an account. Anything here that
// the operator does not recognise is worth explaining before it is dismissed.
const WATCHED = [
  'admin.role_granted',
  'admin.role_revoked',
  'admin.user_mfa_reset',
  'admin.user_deleted',
  'admin.user_suspended',
  'admin.org_deleted',
  'admin.settings_updated',
  'mfa_disabled',
  'mfa_enabled',
  'password_reset_completed',
  'account_locked',
];

const prisma = new PrismaClient();

async function main() {
  const days = Number(process.argv[2] ?? 30) || 30;
  const since = new Date(Date.now() - days * 86400000);

  console.log(
    `Audit sweep — last ${days} days (since ${since.toISOString()})\n`,
  );

  const rows = await prisma.auditLog.findMany({
    where: { action: { in: WATCHED }, occurredAt: { gte: since } },
    include: { actor: { select: { email: true } } },
    orderBy: { occurredAt: 'desc' },
  });

  if (rows.length === 0) {
    console.log(
      'No privileged or account-takeover events in the window. Clean.\n',
    );
  } else {
    console.log(`${rows.length} event(s):\n`);
    for (const r of rows) {
      const who = r.actor?.email ?? (r.actorUserId ? r.actorUserId : 'system');
      console.log(
        `  ${r.occurredAt.toISOString()}  ${r.action.padEnd(26)} ${who.padEnd(32)} ${r.actorIp ?? '-'}`,
      );
    }
    console.log();
  }

  // The distinct source addresses behind privileged activity. An operator knows their own;
  // one they do not recognise is the clearest single signal available here.
  const ips = [...new Set(rows.map((r) => r.actorIp).filter(Boolean))];
  console.log(
    `Distinct IPs behind these events: ${ips.length ? ips.join(', ') : 'none'}`,
  );

  // A sign-in from a brand-new account with a privileged role would not appear above, so
  // count the privileged accounts directly as a cross-check.
  const admins = await prisma.user.findMany({
    where: { role: { in: ['platform_admin', 'org_admin'] }, deletedAt: null },
    select: { email: true, role: true, createdAt: true, mfaEnabled: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\nPrivileged accounts (${admins.length}):`);
  for (const a of admins) {
    console.log(
      `  ${a.role.padEnd(16)} ${a.email.padEnd(34)} created ${a.createdAt.toISOString().slice(0, 10)}  MFA ${a.mfaEnabled ? 'on' : 'OFF'}`,
    );
  }

  const failed = await prisma.auditLog.count({
    where: { action: 'login_failed', occurredAt: { gte: since } },
  });
  console.log(`\nFailed sign-ins in the window: ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
