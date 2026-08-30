import { PrismaClient, type UserRole } from '@prisma/client';

/**
 * Promote an existing account to a privileged role.
 *
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com instructor
 *
 * Run as a one-off against production:
 *   railway ssh --service api -- npm run admin:grant -- someone@example.com
 *
 * Deliberately a promotion rather than a create-with-password. The person signs up through
 * the normal flow, choosing their own password and verifying their own email, and this only
 * changes their role — so no real credential ever passes through an environment variable, a
 * deploy log, or this file. It also means there is no bootstrap account whose password is
 * known to whoever set the service up.
 *
 * Not exposed as an HTTP endpoint on purpose: the first admin cannot be granted by an
 * existing admin, and a public route that mints privilege has to be either unauthenticated
 * (obviously unsafe) or gated on the very role it creates (impossible). Shell access to the
 * running service is the honest trust boundary for this one action.
 */

const GRANTABLE: UserRole[] = ['platform_admin', 'org_admin', 'instructor'];

async function main() {
  const [email, roleArg] = process.argv.slice(2);
  const role = (roleArg ?? 'platform_admin') as UserRole;

  if (!email) {
    console.error('Usage: npm run admin:grant -- <email> [role]');
    console.error(`Roles: ${GRANTABLE.join(', ')} (default platform_admin)`);
    process.exit(1);
  }
  if (!GRANTABLE.includes(role)) {
    console.error(`Refusing: "${role}" is not a grantable role.`);
    console.error(`Grantable: ${GRANTABLE.join(', ')}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.error(`Refusing: no account exists for ${email}.`);
      console.error('Sign up through the app first, then run this again.');
      process.exit(1);
    }
    if (!user.passwordHash) {
      // The seeded content-team account is in this state. Granting to it would produce a
      // privileged account nobody can ever log into.
      console.error(
        `Refusing: ${email} has no password set and could never sign in.`,
      );
      process.exit(1);
    }
    if (!user.emailVerifiedAt) {
      // Verification is what proves the mailbox belongs to the person being promoted. Skipping
      // it would allow privilege to be granted to an address nobody has demonstrated control of.
      console.error(`Refusing: ${email} has not verified their email address.`);
      console.error('Verify the address first, then run this again.');
      process.exit(1);
    }
    if (user.status !== 'active') {
      console.error(`Refusing: ${email} is ${user.status}, not active.`);
      process.exit(1);
    }
    if (user.role === role) {
      console.log(`No change: ${email} is already ${role}.`);
      return;
    }

    const previousRole = user.role;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          role,
          // Force every existing session to re-authenticate, so the new role takes effect
          // immediately and — for a privileged role — the MFA enrolment gate is actually hit
          // rather than being skipped by an access token minted moments earlier.
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // A privilege change is exactly the kind of event the audit log exists for. actorUserId
      // is null because this was run from a shell, not by a signed-in user.
      prisma.auditLog.create({
        data: {
          actorUserId: null,
          action: 'admin.role_granted',
          targetType: 'user',
          targetId: user.id,
          metadata: { email, previousRole, newRole: role, via: 'cli' },
        },
      }),
    ]);

    console.log(`Granted: ${email} is now ${role} (was ${previousRole}).`);
    console.log('All existing sessions were revoked; they must sign in again.');

    if (role === 'platform_admin' || role === 'org_admin') {
      console.log('');
      console.log('This role requires MFA. At next sign-in they will be taken');
      console.log('through enrolment before they can reach anything else.');
      console.log('');
      console.log('Their recovery codes are the ONLY way back in if the');
      console.log('authenticator is lost — password reset does not clear MFA');
      console.log('for this role. They must be saved somewhere safe.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
