import { PrismaClient } from '@prisma/client';

/**
 * Shows whether the Paystack wiring is actually working.
 *
 *   railway ssh --service api -- npm run billing:check
 *
 * Setting up a payment provider fails in quiet ways: the webhook URL has a typo, the
 * signature does not verify, the plan code is missing so a trial would never convert. None of
 * those announce themselves — a customer simply does not get access, days later. This prints
 * the four things that say whether it is wired correctly, so the answer takes a second rather
 * than an afternoon in the logs.
 *
 * Reads and prints only.
 */

const prisma = new PrismaClient();

const yesNo = (ok: boolean) => (ok ? 'yes' : 'NO');

async function main() {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? '';
  const individual = process.env.PAYSTACK_PLAN_INDIVIDUAL_MONTHLY ?? '';
  const organization = process.env.PAYSTACK_PLAN_ORGANIZATION_MONTHLY ?? '';
  const individualAnnual = process.env.PAYSTACK_PLAN_INDIVIDUAL_ANNUAL ?? '';
  const organizationAnnual =
    process.env.PAYSTACK_PLAN_ORGANIZATION_ANNUAL ?? '';

  console.log('Configuration');
  console.log(`  Secret key set:        ${yesNo(Boolean(secret))}`);
  console.log(
    `  Mode:                  ${secret.startsWith('sk_live_') ? 'LIVE — real money' : secret.startsWith('sk_test_') ? 'test' : 'unset'}`,
  );
  // Checkout refuses any plan with no code behind it. A trial would otherwise start free
  // and never convert, and a paid plan would charge once and never renew — both give the
  // product away, just on different timescales.
  console.log(
    `  Individual monthly:    ${individual || 'MISSING — monthly checkout and trials refused'}`,
  );
  console.log(
    `  Individual annual:     ${individualAnnual || 'MISSING — annual checkout refused'}`,
  );
  console.log(
    `  Organisation monthly:  ${organization || 'MISSING — monthly checkout and trials refused'}`,
  );
  console.log(
    `  Organisation annual:   ${organizationAnnual || 'MISSING — annual checkout refused'}`,
  );

  const deliveries = await prisma.webhookEvent.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 10,
    select: {
      eventType: true,
      receivedAt: true,
      processedAt: true,
      error: true,
    },
  });

  console.log(`\nWebhook deliveries (${deliveries.length} most recent)`);
  if (deliveries.length === 0) {
    console.log(
      '  None yet. Either no payment has been attempted, or Paystack cannot reach the',
    );
    console.log(
      '  webhook URL — a delivery that fails the signature check is rejected before it is',
    );
    console.log(
      '  recorded, so a wrong secret key looks exactly like this too.',
    );
  } else {
    for (const d of deliveries) {
      const state = d.processedAt
        ? 'processed'
        : d.error
          ? `FAILED: ${d.error.slice(0, 60)}`
          : 'received, not yet processed';
      console.log(
        `  ${d.receivedAt.toISOString()}  ${d.eventType.padEnd(24)} ${state}`,
      );
    }
  }

  const [subscriptions, payments] = await Promise.all([
    prisma.subscription.groupBy({ by: ['status'], _count: true }),
    prisma.payment.aggregate({
      where: { status: 'success', kind: 'subscription' },
      _sum: { amountKobo: true },
      _count: true,
    }),
  ]);

  console.log('\nSubscriptions');
  if (subscriptions.length === 0) console.log('  none');
  for (const s of subscriptions) {
    console.log(`  ${s.status.padEnd(12)} ${s._count}`);
  }

  // Card-verification charges are excluded: they are refunded and are not revenue.
  const naira = (payments._sum.amountKobo ?? 0) / 100;
  console.log(
    `\nConfirmed revenue: ${payments._count} payment(s), NGN ${naira.toLocaleString('en-NG')}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
