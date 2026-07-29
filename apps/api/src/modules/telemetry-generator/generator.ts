import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { SeededRng } from './rng';
import {
  APPLICATIONS,
  DEPARTMENTS,
  FIRST_NAMES,
  HOME_COUNTRIES,
  HOSTNAME_PREFIX,
  JOB_TITLES,
  LAST_NAMES,
  LOOKALIKE_INTERNAL_DOMAIN,
  MALICIOUS_DOMAIN,
  ORG_DOMAIN,
  RISKY_UNFAMILIAR_COUNTRIES,
  TRAVEL_COUNTRIES,
} from './templates';

// The §12.1 ground-truth-definition schema, narrowed to what the generator reads.
export interface GroundTruthDefinition {
  metadata: { world_time_window_hours?: number };
  population: {
    narrative_identities: { ref: string; attributes: { department: string; job_title: string; home_country: string } }[];
    narrative_devices: { ref: string; attributes: { hostname: string; os_platform: string } }[];
    decoy_population_size: { identities: number; devices: number };
    world_time_window_hours: number;
  };
  kill_chain: {
    step_order: number;
    mitre_technique_id: string;
    entity_ref: string;
    event_template_id: string;
    relative_timestamp: string;
    correlation_group: string;
    is_required_for_full_credit: boolean;
  }[];
  noise_profile: {
    false_positive_bait: { event_template_id: string; count: number }[];
  };
}

export interface GeneratedTelemetry {
  identities: Prisma.IdentityCreateManyInput[];
  devices: Prisma.DeviceCreateManyInput[];
  signInEvents: Prisma.SignInEventCreateManyInput[];
  emailMessages: Prisma.EmailMessageCreateManyInput[];
  emailAttachments: Prisma.EmailAttachmentCreateManyInput[];
  emailUrls: Prisma.EmailUrlCreateManyInput[];
}

function parseRelativeTimestamp(base: Date, relative: string): Date {
  const match = /^\+(\d+)h(?:(\d+)m)?$/.exec(relative.trim());
  if (!match) return new Date(base);
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return new Date(base.getTime() + (hours * 60 + minutes) * 60 * 1000);
}

function upn(firstName: string, lastName: string): string {
  return `${firstName}.${lastName}`.toLowerCase() + `@${ORG_DOMAIN}`;
}

/**
 * Implements the 5-stage pipeline from §7.2: world seeding, baseline behavior synthesis,
 * ground-truth event injection, correlation stitching, and noise injection. Pure function of
 * (seed, groundTruthDefinition) — no I/O — so it is exactly reproducible and unit-testable
 * without a database (§7.2's reproducibility requirement, §3.11 verification strategy).
 */
export function generateTelemetry(
  sessionId: string,
  seed: bigint,
  def: GroundTruthDefinition,
  techniqueIdBySlug: Map<string, string>,
): GeneratedTelemetry {
  const rng = new SeededRng(seed);
  const worldStart = new Date();
  worldStart.setMinutes(0, 0, 0);

  const identities: Prisma.IdentityCreateManyInput[] = [];
  const devices: Prisma.DeviceCreateManyInput[] = [];
  const signInEvents: Prisma.SignInEventCreateManyInput[] = [];
  const emailMessages: Prisma.EmailMessageCreateManyInput[] = [];
  const emailAttachments: Prisma.EmailAttachmentCreateManyInput[] = [];
  const emailUrls: Prisma.EmailUrlCreateManyInput[] = [];

  // ---- Stage 1: world seeding ----
  const identityByRef = new Map<string, Prisma.IdentityCreateManyInput & { id: string }>();
  const deviceByRef = new Map<string, Prisma.DeviceCreateManyInput & { id: string }>();

  for (const narrative of def.population.narrative_identities) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const id = randomUUID();
    const identity: Prisma.IdentityCreateManyInput = {
      id,
      sessionId,
      displayName: `${firstName} ${lastName}`,
      userPrincipalName: upn(firstName, lastName),
      department: narrative.attributes.department,
      jobTitle: narrative.attributes.job_title,
      riskLevel: 'none',
      mfaStatus: rng.pick(['enforced', 'registered_not_enforced'] as const),
      accountStatus: 'active',
      isPrivileged: false,
      homeCountry: narrative.attributes.home_country,
      isGroundTruthActor: true,
    };
    identities.push(identity);
    identityByRef.set(narrative.ref, { ...identity, id });
  }

  for (const narrative of def.population.narrative_devices) {
    const id = randomUUID();
    const device: Prisma.DeviceCreateManyInput = {
      id,
      sessionId,
      hostname: narrative.attributes.hostname,
      osPlatform: narrative.attributes.os_platform,
      osVersion: narrative.attributes.os_platform === 'windows' ? '11 23H2' : 'Ubuntu 22.04',
      riskLevel: 'none',
      isolationStatus: 'not_isolated',
      lastSeenAt: new Date(),
      isGroundTruthActor: true,
    };
    devices.push(device);
    deviceByRef.set(narrative.ref, { ...device, id });
  }

  const decoyIdentities: (Prisma.IdentityCreateManyInput & { id: string })[] = [];
  for (let i = 0; i < def.population.decoy_population_size.identities; i++) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const department = rng.pick(DEPARTMENTS);
    const home = rng.pick(HOME_COUNTRIES);
    const id = randomUUID();
    const identity: Prisma.IdentityCreateManyInput = {
      id,
      sessionId,
      displayName: `${firstName} ${lastName}`,
      userPrincipalName: upn(firstName, lastName),
      department,
      jobTitle: rng.pick(JOB_TITLES[department]),
      riskLevel: 'none',
      mfaStatus: rng.pick(['enforced', 'registered_not_enforced', 'not_registered'] as const),
      accountStatus: 'active',
      isPrivileged: false,
      homeCountry: home.country,
      isGroundTruthActor: false,
    };
    identities.push(identity);
    decoyIdentities.push({ ...identity, id });
  }

  for (let i = 0; i < def.population.decoy_population_size.devices; i++) {
    const department = rng.pick(DEPARTMENTS);
    const id = randomUUID();
    const device: Prisma.DeviceCreateManyInput = {
      id,
      sessionId,
      hostname: `${HOSTNAME_PREFIX[department]}-WKS-${String(rng.intBetween(1, 99)).padStart(2, '0')}`,
      osPlatform: 'windows',
      osVersion: '11 23H2',
      riskLevel: 'none',
      isolationStatus: 'not_isolated',
      lastSeenAt: new Date(),
      isGroundTruthActor: false,
    };
    devices.push(device);
  }

  // ---- Stage 2: baseline behavior synthesis ----
  const allIdentitiesWithHome = [...identityByRef.values(), ...decoyIdentities];
  for (const identity of allIdentitiesWithHome) {
    const home = HOME_COUNTRIES.find((c) => c.country === identity.homeCountry) ?? HOME_COUNTRIES[0];
    const baselineCount = rng.intBetween(2, 4);
    for (let i = 0; i < baselineCount; i++) {
      const occurredAt = new Date(worldStart.getTime() + rng.intBetween(0, def.population.world_time_window_hours * 60) * 60 * 1000);
      signInEvents.push({
        id: randomUUID(),
        sessionId,
        occurredAt,
        raw: { source: 'baseline', identityRef: identity.id },
        isGroundTruthEvidence: false,
        identityId: identity.id,
        sourceIp: syntheticIp(rng),
        sourceCountry: home.country,
        sourceCity: home.city,
        application: rng.pick(APPLICATIONS),
        result: 'success',
        isLegacyAuth: false,
        clientApp: 'Modern Auth Client',
      });
    }
  }

  // ---- Correlation groups (stage 4, resolved up front so injected events can reference them) ----
  const correlationIdByGroup = new Map<string, string>();
  for (const step of def.kill_chain) {
    if (!correlationIdByGroup.has(step.correlation_group)) {
      correlationIdByGroup.set(step.correlation_group, randomUUID());
    }
  }

  // ---- Stage 3: ground-truth event injection ----
  for (const step of def.kill_chain) {
    const identity = identityByRef.get(step.entity_ref);
    if (!identity) continue;
    const occurredAt = parseRelativeTimestamp(worldStart, step.relative_timestamp);
    const correlationId = correlationIdByGroup.get(step.correlation_group)!;
    const mitreTechniqueId = techniqueIdBySlug.get(step.mitre_technique_id) ?? null;

    applyEventTemplate(step.event_template_id, {
      rng,
      sessionId,
      identity,
      occurredAt,
      correlationId,
      mitreTechniqueId,
      isGroundTruthEvidence: true,
      signInEvents,
      emailMessages,
      emailAttachments,
      emailUrls,
    });
  }

  // ---- Stage 5: noise injection (false-positive bait, §8.6) ----
  for (const bait of def.noise_profile.false_positive_bait) {
    for (let i = 0; i < bait.count; i++) {
      const decoyIdentity = rng.pick(decoyIdentities);
      const occurredAt = new Date(worldStart.getTime() + rng.intBetween(0, def.population.world_time_window_hours * 60) * 60 * 1000);
      applyEventTemplate(bait.event_template_id, {
        rng,
        sessionId,
        identity: decoyIdentity,
        occurredAt,
        correlationId: null,
        mitreTechniqueId: null,
        isGroundTruthEvidence: false,
        signInEvents,
        emailMessages,
        emailAttachments,
        emailUrls,
      });
    }
  }

  return { identities, devices, signInEvents, emailMessages, emailAttachments, emailUrls };
}

interface TemplateContext {
  rng: SeededRng;
  sessionId: string;
  identity: Prisma.IdentityCreateManyInput & { id: string };
  occurredAt: Date;
  correlationId: string | null;
  mitreTechniqueId: string | null;
  isGroundTruthEvidence: boolean;
  signInEvents: Prisma.SignInEventCreateManyInput[];
  emailMessages: Prisma.EmailMessageCreateManyInput[];
  emailAttachments: Prisma.EmailAttachmentCreateManyInput[];
  emailUrls: Prisma.EmailUrlCreateManyInput[];
}

function applyEventTemplate(templateId: string, ctx: TemplateContext): void {
  switch (templateId) {
    case 'phishing_email_invoice_lookalike_login_v1': {
      const emailId = randomUUID();
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: `<${randomUUID()}@${MALICIOUS_DOMAIN}>`,
        direction: 'inbound',
        senderAddress: `billing@${MALICIOUS_DOMAIN}`,
        senderDisplayName: 'Accounts Payable Portal',
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: 'Action Required: Invoice #48213 Payment Verification',
        bodyHtml:
          '<p>Your recent invoice requires verification before payment can be processed. Please sign in to review and confirm.</p>',
        headersRaw: {
          'Received-Chain': [`mail.${MALICIOUS_DOMAIN}`, 'edge-relay-03.example-mx.net'],
          'Authentication-Results': `spf=fail smtp.mailfrom=${MALICIOUS_DOMAIN}; dkim=none; dmarc=fail`,
        },
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      ctx.emailUrls.push({
        id: randomUUID(),
        emailMessageId: emailId,
        url: `https://${MALICIOUS_DOMAIN}/invoice/verify?ref=48213`,
        displayText: 'Review Invoice #48213',
        reputation: 'malicious',
        isRewrittenBySafeLinks: false,
      });
      break;
    }
    case 'risky_signin_new_country_v1': {
      const risky = ctx.rng.pick(RISKY_UNFAMILIAR_COUNTRIES);
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'risky_signin_new_country' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        sourceIp: syntheticIp(ctx.rng),
        sourceCountry: risky.country,
        sourceCity: risky.city,
        application: 'Office 365 Exchange Online',
        result: 'success',
        isLegacyAuth: false,
        clientApp: 'Modern Auth Client',
      });
      break;
    }
    case 'legitimate_travel_signin_v1': {
      const travel = ctx.rng.pick(TRAVEL_COUNTRIES);
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        raw: { source: 'noise', pattern: 'legitimate_travel_signin' },
        isGroundTruthEvidence: false,
        identityId: ctx.identity.id,
        sourceIp: syntheticIp(ctx.rng),
        sourceCountry: travel.country,
        sourceCity: travel.city,
        application: 'Office 365 Exchange Online',
        result: 'success',
        isLegacyAuth: false,
        clientApp: 'Modern Auth Client',
      });
      break;
    }
    case 'benign_it_admin_email_v1': {
      const emailId = randomUUID();
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        messageId: `<${randomUUID()}@${LOOKALIKE_INTERNAL_DOMAIN}>`,
        direction: 'inbound',
        senderAddress: `it-notifications@${LOOKALIKE_INTERNAL_DOMAIN}`,
        senderDisplayName: 'IT Notifications',
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: 'Scheduled Maintenance Window This Weekend',
        bodyHtml: '<p>Reminder: IT will perform scheduled maintenance on internal systems this weekend. No action needed.</p>',
        headersRaw: {
          'Received-Chain': [`mail.${LOOKALIKE_INTERNAL_DOMAIN}`],
          'Authentication-Results': `spf=fail smtp.mailfrom=${LOOKALIKE_INTERNAL_DOMAIN}; dkim=none; dmarc=fail`,
        },
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: false,
      });
      break;
    }
    default:
      break;
  }
}

function syntheticIp(rng: SeededRng): string {
  return `${rng.intBetween(20, 223)}.${rng.intBetween(0, 255)}.${rng.intBetween(0, 255)}.${rng.intBetween(1, 254)}`;
}

