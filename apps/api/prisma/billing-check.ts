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
  const webhookSecrets = (process.env.PAYSTACK_WEBHOOK_SECRET ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
  // Paystack runs two webhook signing schemes and picks per mode, so this says which one we
  // can actually verify. Both are accepted; the risk is holding neither credential that the
  // arriving scheme needs, and that failure is invisible — the endpoint answers 200 either
  // way, so Paystack marks each rejected delivery as accepted and never retries it.
  console.log(
    `  Webhook signing secret: ${
      webhookSecrets.length === 0
        ? 'not set — only legacy x-paystack-signature can be verified'
        : `${webhookSecrets.length} set${webhookSecrets.every((s) => s.startsWith('whsec_')) ? '' : ' — WARNING: one does not start with whsec_'}`
    }`,
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

  // What was actually captured when someone "put their card in". A trial converts by
  // charging a stored authorisation seven days later, with nobody watching, so the only
  // moment to find out the card is unusable is now — and the only way to know a card was
  // taken at all is to look at the one Paystack sent back.
  const captures = await prisma.payment.findMany({
    where: { kind: 'card_verification' },
    orderBy: { paidAt: 'desc' },
    take: 5,
    select: { reference: true, status: true, paidAt: true, raw: true },
  });

  console.log('\nCards captured for trials (5 most recent)');
  if (captures.length === 0) console.log('  none');
  for (const c of captures) {
    const auth = (
      (c.raw as Record<string, unknown> | null)?.data as
        Record<string, unknown> | undefined
    )?.authorization as Record<string, unknown> | undefined;
    if (!auth) {
      console.log(`  ${c.reference}  no authorisation recorded`);
      continue;
    }
    const card = `${auth.brand ?? auth.card_type ?? '?'} ****${auth.last4 ?? '????'}`;
    const expiry = `${auth.exp_month ?? '??'}/${auth.exp_year ?? '????'}`;
    // Paystack returns reusable: false for channels that cannot be charged again. The
    // trial would then run its week and quietly fail to convert.
    const reuse =
      auth.reusable === false
        ? 'NOT REUSABLE — trial will not convert'
        : 'reusable';
    console.log(
      `  ${c.paidAt?.toISOString() ?? '(unpaid)'}  ${card}  exp ${expiry}  ${String(auth.channel ?? '?')}  ${reuse}  refund: ${c.status}`,
    );
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
