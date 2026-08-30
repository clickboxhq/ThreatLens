import { PrismaClient } from '@prisma/client';

/**
 * Break-glass: clear MFA from an account that has been locked out of it.
 *
 *   npm run admin:reset-mfa -- someone@example.com
 *   railway ssh --service api -- npm run admin:reset-mfa -- someone@example.com
 *
 * Why this has to exist. MFA is mandatory for the privileged roles, and for those roles the
 * password-reset flow deliberately does NOT clear it (auth.service.ts) — otherwise anyone with
 * access to an admin's mailbox could strip the second factor, which would make it decorative.
 * The consequence is that an admin who loses their authenticator and their recovery codes has
 * no route back in at all: they cannot log in, and cannot reach the disable endpoint without
 * logging in first.
 *
 * Without this command the only remedy is hand-editing the production database, which is
 * strictly worse: unaudited, unreviewed, and far easier to get wrong. Requiring shell access
 * to the running service is a deliberate and appropriate trust boundary for the operation —
 * the same one that gates granting the role in the first place.
 *
 * The account is not left unprotected: for a role that requires MFA, the next sign-in puts it
 * straight back through enrolment before it can reach anything.
 */

async function main() {
  const [email] = process.argv.slice(2);

  if (!email) {
    console.error('Usage: npm run admin:reset-mfa -- <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.error(`Refusing: no account exists for ${email}.`);
      process.exit(1);
    }
    if (!user.mfaEnabled) {
      console.log(`No change: MFA is not enabled on ${email}.`);
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodesHash: [],
          // Anything already issued must stop working: the point of the reset is that control
          // of this account is in question.
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // Removing a second factor is precisely the kind of event that must leave a trace. Null
      // actor because this ran from a shell rather than as a signed-in user; the metadata
      // records what was cleared and from which role.
      prisma.auditLog.create({
        data: {
          actorUserId: null,
          action: 'admin.mfa_reset',
          targetType: 'user',
          targetId: user.id,
          metadata: { email, role: user.role, via: 'cli' },
        },
      }),
    ]);

    console.log(`MFA cleared for ${email} (${user.role}).`);
    console.log('All existing sessions were revoked.');
    console.log('');
    console.log('This is recorded in the audit log as admin.mfa_reset.');

    if (user.role === 'platform_admin' || user.role === 'org_admin') {
      console.log('');
      console.log('This role requires MFA, so the next sign-in will go');
      console.log('straight through enrolment again. Keep the new recovery');
      console.log('codes this time — they are the only way back.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
