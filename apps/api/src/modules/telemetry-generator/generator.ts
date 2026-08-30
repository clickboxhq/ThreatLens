import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { SeededRng } from './rng';
import { generateBaselineAuditEvents } from './directory-audit';
import {
  APPLICATIONS,
  CLOUD_STORAGE_BUCKET,
  CLOUD_STORAGE_BUCKET_CUSTOMER_EXPORTS,
  DEPARTMENTS,
  DNS_BACKDOOR_COMMAND_LINE,
  DNS_BACKDOOR_TOOL_PATH,
  DNS_TUNNEL_C2_IP,
  EXEC_LOOKALIKE_DOMAIN,
  EXEC_NAME,
  EXEC_TITLE,
  FILE_SERVER_IP,
  FILELESS_MALWARE_COMMAND_LINE,
  FIRST_NAMES,
  HOME_COUNTRIES,
  HOSTNAME_PREFIX,
  JOB_TITLES,
  KERBEROASTING_COMMAND_LINE,
  KERBEROASTING_TOOL_PATH,
  LAST_NAMES,
  LEGITIMATE_SCRIPT_PATH,
  LEGITIMATE_STARTUP_SHORTCUT_PATH,
  LOOKALIKE_INTERNAL_DOMAIN,
  LSASS_DUMP_COMMAND_LINE_TEMPLATE,
  LSASS_DUMP_FILE_PATH,
  MALICIOUS_DOMAIN,
  MALICIOUS_OAUTH_APP_NAME,
  MALWARE_C2_IP,
  MALWARE_DELIVERY_DOMAIN,
  MALWARE_PERSISTENCE_STARTUP_PATH,
  MONITORING_USER_AGENT,
  NON_BROWSER_USER_AGENTS,
  BROWSER_USER_AGENT,
  OAUTH_PHISHING_DOMAIN,
  ORG_DOMAIN,
  PERSONAL_EMAIL_DOMAIN_FOR_GENERATION,
  buildEmailHeaders,
  RANSOM_NOTE_FILENAME,
  RANSOMWARE_EXFIL_IP,
  REMOVABLE_MEDIA_DRIVE,
  RISKY_UNFAMILIAR_COUNTRIES,
  SCHEDULED_TASK_COMMAND_LINE,
  SENSITIVE_ATTACHMENT_FILENAMES,
  SHARED_FILE_PATHS,
  SQLI_PROBE_PAYLOADS,
  SQLI_UNION_EXFIL_PAYLOAD,
  TRAVEL_COUNTRIES,
  TROJAN_DROPPED_PAYLOAD_PATH,
  TROJAN_INSTALLER_FILENAME,
  WEB_SQLI_ENDPOINT_PATH,
  WEBSHELL_PATH,
} from './templates';

// The §12.1 ground-truth-definition schema, narrowed to what the generator reads.
export interface GroundTruthDefinition {
  metadata: { world_time_window_hours?: number };
  population: {
    narrative_identities: {
      ref: string;
      attributes: {
        department: string;
        job_title: string;
        home_country: string;
      };
    }[];
    narrative_devices: {
      ref: string;
      attributes: { hostname: string; os_platform: string };
    }[];
    decoy_population_size: { identities: number; devices: number };
    world_time_window_hours: number;
  };
  kill_chain: {
    step_order: number;
    mitre_technique_id: string;
    entity_ref: string;
    // Only set for templates that write device-scoped events (process/file/network) —
    // the other templates (email, sign-in) only ever need the identity ref.
    device_ref?: string;
    event_template_id: string;
    relative_timestamp: string;
    correlation_group: string;
    is_required_for_full_credit: boolean;
  }[];
  noise_profile: {
    // device_ref: only needed for device-scoped bait templates (e.g. a benign automated
    // client hitting a web server) — event, sign-in, and email bait don't set it.
    false_positive_bait: {
      event_template_id: string;
      count: number;
      device_ref?: string;
    }[];
  };
}

export interface GeneratedTelemetry {
  identities: Prisma.IdentityCreateManyInput[];
  devices: Prisma.DeviceCreateManyInput[];
  signInEvents: Prisma.SignInEventCreateManyInput[];
  processEvents: Prisma.ProcessEventCreateManyInput[];
  fileEvents: Prisma.FileEventCreateManyInput[];
  networkEvents: Prisma.NetworkEventCreateManyInput[];
  cloudEvents: Prisma.CloudEventCreateManyInput[];
  httpRequests: Prisma.HttpRequestCreateManyInput[];
  emailMessages: Prisma.EmailMessageCreateManyInput[];
  emailAttachments: Prisma.EmailAttachmentCreateManyInput[];
  emailUrls: Prisma.EmailUrlCreateManyInput[];
  directoryAuditEvents: Prisma.DirectoryAuditEventCreateManyInput[];
}

/** How much ordinary history precedes the incident. A month is the smallest window in which
 * "this account normally signs in from Chicago on weekdays" is a claim an investigator can
 * actually make from the data rather than take on faith. */
const BASELINE_HISTORY_DAYS = 30;

/** Sign-ins per identity per day of history — enough to establish a pattern without burying
 * the kill chain. Kept low-single-digit so density around the incident stays comparable to
 * before, which matters: the impossible-travel rule compares *consecutive* sign-ins, so a
 * denser baseline would manufacture extra adjacent pairs around the attack. */
const BASELINE_SIGNINS_PER_DAY_MIN = 1;
const BASELINE_SIGNINS_PER_DAY_MAX = 3;

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

  // Every scenario's kill chain is written as an offset from worldStart, so the attack has to
  // stay anchored there. The organisation's ordinary life is generated *backwards* from that
  // point instead: a month of routine sign-ins and directory churn leading up to the incident.
  // Doing it this way means no scenario's ground-truth definition changes, and an investigator
  // gets a real baseline to compare against rather than a day of thin, obviously-staged noise.
  const historyStart = new Date(
    worldStart.getTime() - BASELINE_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const identities: Prisma.IdentityCreateManyInput[] = [];
  const devices: Prisma.DeviceCreateManyInput[] = [];
  const signInEvents: Prisma.SignInEventCreateManyInput[] = [];
  const processEvents: Prisma.ProcessEventCreateManyInput[] = [];
  const fileEvents: Prisma.FileEventCreateManyInput[] = [];
  const networkEvents: Prisma.NetworkEventCreateManyInput[] = [];
  const cloudEvents: Prisma.CloudEventCreateManyInput[] = [];
  const httpRequests: Prisma.HttpRequestCreateManyInput[] = [];
  const emailMessages: Prisma.EmailMessageCreateManyInput[] = [];
  const emailAttachments: Prisma.EmailAttachmentCreateManyInput[] = [];
  const emailUrls: Prisma.EmailUrlCreateManyInput[] = [];
  const directoryAuditEvents: Prisma.DirectoryAuditEventCreateManyInput[] = [];

  // ---- Stage 1: world seeding ----
  const identityByRef = new Map<
    string,
    Prisma.IdentityCreateManyInput & { id: string }
  >();
  const deviceByRef = new Map<
    string,
    Prisma.DeviceCreateManyInput & { id: string }
  >();

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
      osVersion:
        narrative.attributes.os_platform === 'windows'
          ? '11 23H2'
          : 'Ubuntu 22.04',
      riskLevel: 'none',
      isolationStatus: 'not_isolated',
      lastSeenAt: new Date(),
      isGroundTruthActor: true,
    };
    devices.push(device);
    deviceByRef.set(narrative.ref, { ...device, id });
  }

  const decoyIdentities: (Prisma.IdentityCreateManyInput & { id: string })[] =
    [];
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
      mfaStatus: rng.pick([
        'enforced',
        'registered_not_enforced',
        'not_registered',
      ] as const),
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
    const home =
      HOME_COUNTRIES.find((c) => c.country === identity.homeCountry) ??
      HOME_COUNTRIES[0];
    // Spread across the history window *and* the scenario's own window, so the account has a
    // month of routine activity behind it and continues to look alive during the incident.
    const historyMinutes = BASELINE_HISTORY_DAYS * 24 * 60;
    const scenarioMinutes = def.population.world_time_window_hours * 60;
    const baselineCount =
      rng.intBetween(
        BASELINE_SIGNINS_PER_DAY_MIN,
        BASELINE_SIGNINS_PER_DAY_MAX,
      ) * BASELINE_HISTORY_DAYS;

    for (let i = 0; i < baselineCount; i++) {
      const offsetMinutes = rng.intBetween(0, historyMinutes + scenarioMinutes);
      const occurredAt = new Date(
        historyStart.getTime() + offsetMinutes * 60 * 1000,
      );
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

    directoryAuditEvents.push(
      ...generateBaselineAuditEvents(
        sessionId,
        { id: identity.id, displayName: identity.displayName },
        rng,
        historyStart,
        worldStart,
      ),
    );
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
    const device = step.device_ref
      ? deviceByRef.get(step.device_ref)
      : undefined;
    const occurredAt = parseRelativeTimestamp(
      worldStart,
      step.relative_timestamp,
    );
    const correlationId = correlationIdByGroup.get(step.correlation_group)!;
    const mitreTechniqueId =
      techniqueIdBySlug.get(step.mitre_technique_id) ?? null;

    applyEventTemplate(step.event_template_id, {
      rng,
      sessionId,
      identity,
      device,
      decoyIdentities,
      occurredAt,
      correlationId,
      mitreTechniqueId,
      isGroundTruthEvidence: true,
      signInEvents,
      processEvents,
      fileEvents,
      networkEvents,
      cloudEvents,
      httpRequests,
      emailMessages,
      emailAttachments,
      emailUrls,
    });
  }

  // ---- Stage 5: noise injection (false-positive bait, §8.6) ----
  for (const bait of def.noise_profile.false_positive_bait) {
    for (let i = 0; i < bait.count; i++) {
      const decoyIdentity = rng.pick(decoyIdentities);
      const occurredAt = new Date(
        worldStart.getTime() +
          rng.intBetween(0, def.population.world_time_window_hours * 60) *
            60 *
            1000,
      );
      const device = bait.device_ref
        ? deviceByRef.get(bait.device_ref)
        : undefined;
      applyEventTemplate(bait.event_template_id, {
        rng,
        sessionId,
        identity: decoyIdentity,
        device,
        decoyIdentities,
        occurredAt,
        correlationId: null,
        mitreTechniqueId: null,
        isGroundTruthEvidence: false,
        signInEvents,
        processEvents,
        fileEvents,
        networkEvents,
        cloudEvents,
        httpRequests,
        emailMessages,
        emailAttachments,
        emailUrls,
      });
    }
  }

  return {
    identities,
    devices,
    signInEvents,
    processEvents,
    fileEvents,
    networkEvents,
    cloudEvents,
    httpRequests,
    emailMessages,
    emailAttachments,
    emailUrls,
    directoryAuditEvents,
  };
}

interface TemplateContext {
  rng: SeededRng;
  sessionId: string;
  device?: Prisma.DeviceCreateManyInput & { id: string };
  processEvents: Prisma.ProcessEventCreateManyInput[];
  fileEvents: Prisma.FileEventCreateManyInput[];
  networkEvents: Prisma.NetworkEventCreateManyInput[];
  cloudEvents: Prisma.CloudEventCreateManyInput[];
  httpRequests: Prisma.HttpRequestCreateManyInput[];
  identity: Prisma.IdentityCreateManyInput & { id: string };
  decoyIdentities: (Prisma.IdentityCreateManyInput & { id: string })[];
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
      const phishMessageId = `<${randomUUID()}@${MALICIOUS_DOMAIN}>`;
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: phishMessageId,
        direction: 'inbound',
        senderAddress: `billing@${MALICIOUS_DOMAIN}`,
        senderDisplayName: 'Accounts Payable Portal',
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: 'Action Required: Invoice #48213 Payment Verification',
        bodyHtml:
          '<p>Your recent invoice requires verification before payment can be processed. Please sign in to review and confirm.</p>',
        headersRaw: buildEmailHeaders({
          messageId: phishMessageId,
          senderDisplayName: 'Accounts Payable Portal',
          senderAddress: `billing@${MALICIOUS_DOMAIN}`,
          recipientAddresses: [ctx.identity.userPrincipalName as string],
          subject: 'Action Required: Invoice #48213 Payment Verification',
          occurredAt: ctx.occurredAt,
          receivedChain: [
            `mail.${MALICIOUS_DOMAIN}`,
            'edge-relay-03.example-mx.net',
          ],
          authenticationResults: `spf=fail smtp.mailfrom=${MALICIOUS_DOMAIN}; dkim=none; dmarc=fail`,
          returnPath: `bounce@${MALICIOUS_DOMAIN}`,
        }),
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      const phishUrl = `https://${MALICIOUS_DOMAIN}/invoice/verify?ref=48213`;
      ctx.emailUrls.push({
        id: randomUUID(),
        emailMessageId: emailId,
        url: phishUrl,
        displayText: 'Review Invoice #48213',
        reputation: 'malicious',
        isRewrittenBySafeLinks: false,
      });
      // The victim actually opening the link. This scenario's whole narrative turns on that
      // click — it is what connects the phishing email to the credential theft and the risky
      // sign-in that follows — but nothing previously recorded it, so an analyst asking the
      // obvious question ("did anyone actually click this?") found no evidence either way and
      // had to infer the whole causal chain from sign-in timing alone. The URL must match the
      // EmailUrl above exactly, since that string equality is what correlates the two.
      if (ctx.device) {
        ctx.httpRequests.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(
            ctx.occurredAt.getTime() + ctx.rng.intBetween(2, 9) * 60 * 1000,
          ),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'phishing_link_click' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device.id,
          identityId: ctx.identity.id,
          method: 'GET',
          url: phishUrl,
          userAgent: BROWSER_USER_AGENT,
          statusCode: 200,
          // An internal workstation address, not the synthetic external one used for
          // attacker-originated traffic — this request comes from inside the network.
          sourceIp: `10.20.30.${ctx.rng.intBetween(40, 200)}`,
        });
      }
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
      const itNoticeMessageId = `<${randomUUID()}@${LOOKALIKE_INTERNAL_DOMAIN}>`;
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        messageId: itNoticeMessageId,
        direction: 'inbound',
        senderAddress: `it-notifications@${LOOKALIKE_INTERNAL_DOMAIN}`,
        senderDisplayName: 'IT Notifications',
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: 'Scheduled Maintenance Window This Weekend',
        bodyHtml:
          '<p>Reminder: IT will perform scheduled maintenance on internal systems this weekend. No action needed.</p>',
        headersRaw: buildEmailHeaders({
          messageId: itNoticeMessageId,
          senderDisplayName: 'IT Notifications',
          senderAddress: `it-notifications@${LOOKALIKE_INTERNAL_DOMAIN}`,
          recipientAddresses: [ctx.identity.userPrincipalName as string],
          subject: 'Scheduled Maintenance Window This Weekend',
          occurredAt: ctx.occurredAt,
          receivedChain: [`mail.${LOOKALIKE_INTERNAL_DOMAIN}`],
          authenticationResults: `spf=fail smtp.mailfrom=${LOOKALIKE_INTERNAL_DOMAIN}; dkim=none; dmarc=fail`,
        }),
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: false,
      });
      break;
    }
    case 'password_spray_batch_v1': {
      const attacker = attackerProfileFromSeed(ctx.correlationId ?? 'spray');
      // Victim plus a handful of decoys — enough to cross the Alert Engine's distinct-identity
      // threshold (§8.2) without needing every decoy in the population to be targeted.
      const targets = [ctx.identity, ...ctx.rng.sample(ctx.decoyIdentities, 7)];
      for (const target of targets) {
        const attemptCount = ctx.rng.intBetween(1, 2);
        for (let i = 0; i < attemptCount; i++) {
          const offsetMinutes = ctx.rng.intBetween(0, 20);
          ctx.signInEvents.push({
            id: randomUUID(),
            sessionId: ctx.sessionId,
            occurredAt: new Date(
              ctx.occurredAt.getTime() + offsetMinutes * 60 * 1000,
            ),
            correlationId: ctx.correlationId,
            raw: { source: 'ground_truth', pattern: 'password_spray_attempt' },
            isGroundTruthEvidence: ctx.isGroundTruthEvidence,
            mitreTechniqueId: ctx.mitreTechniqueId,
            identityId: target.id,
            sourceIp: attacker.ip,
            sourceCountry: attacker.country,
            sourceCity: attacker.city,
            application: 'Office 365 Exchange Online',
            result: 'failure',
            failureReason: 'Invalid username or password.',
            isLegacyAuth: true,
            clientApp: 'Legacy Auth Client',
          });
        }
      }
      break;
    }
    case 'password_spray_success_signin_v1': {
      // Derived from the same correlation_id as password_spray_batch_v1 so both templates
      // agree on the attacker's IP/geo without sharing mutable state across the two
      // independent kill-chain steps that invoke them (§7.2 stage 4).
      const attacker = attackerProfileFromSeed(ctx.correlationId ?? 'spray');
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'password_spray_success' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        sourceIp: attacker.ip,
        sourceCountry: attacker.country,
        sourceCity: attacker.city,
        application: 'Office 365 Exchange Online',
        result: 'success',
        isLegacyAuth: true,
        clientApp: 'Legacy Auth Client',
      });
      break;
    }
    case 'bec_wire_transfer_request_v1': {
      const becMessageId = `<${randomUUID()}@${EXEC_LOOKALIKE_DOMAIN}>`;
      const becSubject =
        'URGENT: Confidential Wire Transfer — Approval Needed Today';
      ctx.emailMessages.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: becMessageId,
        direction: 'inbound',
        senderAddress: `m.reyes@${EXEC_LOOKALIKE_DOMAIN}`,
        senderDisplayName: `${EXEC_NAME} (${EXEC_TITLE})`,
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: becSubject,
        bodyHtml: `<p>I need you to process a wire transfer to a new vendor today — this is time-sensitive and confidential, so please don't discuss it with anyone else on the team yet. I'm in meetings all day and won't be reachable by phone. Reply here with the transfer confirmation once it's done.</p>`,
        headersRaw: buildEmailHeaders({
          messageId: becMessageId,
          senderDisplayName: `${EXEC_NAME} (${EXEC_TITLE})`,
          senderAddress: `m.reyes@${EXEC_LOOKALIKE_DOMAIN}`,
          recipientAddresses: [ctx.identity.userPrincipalName as string],
          subject: becSubject,
          occurredAt: ctx.occurredAt,
          receivedChain: [
            `mail.${EXEC_LOOKALIKE_DOMAIN}`,
            'edge-relay-01.example-mx.net',
          ],
          authenticationResults: `spf=fail smtp.mailfrom=${EXEC_LOOKALIKE_DOMAIN}; dkim=none; dmarc=fail`,
          // The message asks the recipient to "reply here" while quietly routing replies to a
          // different mailbox than the executive it impersonates — the defining BEC tell, and
          // one the Student can only find by opening the headers.
          replyTo: `m.reyes.finance@${EXEC_LOOKALIKE_DOMAIN}`,
          returnPath: `bounce@${EXEC_LOOKALIKE_DOMAIN}`,
        }),
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      break;
    }
    case 'bec_wire_transfer_followup_v1': {
      const followupMessageId = `<${randomUUID()}@${EXEC_LOOKALIKE_DOMAIN}>`;
      const followupSubject =
        'Re: URGENT: Confidential Wire Transfer — Approval Needed Today';
      ctx.emailMessages.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: followupMessageId,
        direction: 'inbound',
        senderAddress: `m.reyes@${EXEC_LOOKALIKE_DOMAIN}`,
        senderDisplayName: `${EXEC_NAME} (${EXEC_TITLE})`,
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: followupSubject,
        bodyHtml: `<p>Following up — I need this completed before end of day. Please confirm as soon as the transfer is sent.</p>`,
        headersRaw: buildEmailHeaders({
          messageId: followupMessageId,
          senderDisplayName: `${EXEC_NAME} (${EXEC_TITLE})`,
          senderAddress: `m.reyes@${EXEC_LOOKALIKE_DOMAIN}`,
          recipientAddresses: [ctx.identity.userPrincipalName as string],
          subject: followupSubject,
          occurredAt: ctx.occurredAt,
          receivedChain: [
            `mail.${EXEC_LOOKALIKE_DOMAIN}`,
            'edge-relay-01.example-mx.net',
          ],
          authenticationResults: `spf=fail smtp.mailfrom=${EXEC_LOOKALIKE_DOMAIN}; dkim=none; dmarc=fail`,
          replyTo: `m.reyes.finance@${EXEC_LOOKALIKE_DOMAIN}`,
          returnPath: `bounce@${EXEC_LOOKALIKE_DOMAIN}`,
        }),
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      break;
    }
    case 'mfa_fatigue_batch_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'mfa-fatigue',
      );
      const denialCount = ctx.rng.intBetween(6, 9);
      for (let i = 0; i < denialCount; i++) {
        const offsetMinutes = i * ctx.rng.intBetween(1, 3);
        ctx.signInEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(
            ctx.occurredAt.getTime() + offsetMinutes * 60 * 1000,
          ),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'mfa_fatigue_denial' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          identityId: ctx.identity.id,
          sourceIp: attacker.ip,
          sourceCountry: attacker.country,
          sourceCity: attacker.city,
          application: 'Office 365 Exchange Online',
          result: 'mfa_denied',
          isLegacyAuth: false,
          clientApp: 'Modern Auth Client',
        });
      }
      break;
    }
    case 'mfa_fatigue_success_signin_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'mfa-fatigue',
      );
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'mfa_fatigue_success' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        sourceIp: attacker.ip,
        sourceCountry: attacker.country,
        sourceCity: attacker.city,
        application: 'Office 365 Exchange Online',
        result: 'success',
        isLegacyAuth: false,
        clientApp: 'Modern Auth Client',
      });
      break;
    }
    case 'impossible_travel_first_signin_v1': {
      const home =
        HOME_COUNTRIES.find((c) => c.country === ctx.identity.homeCountry) ??
        HOME_COUNTRIES[0];
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'impossible_travel_first' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        sourceIp: syntheticIp(ctx.rng),
        sourceCountry: home.country,
        sourceCity: home.city,
        application: 'Office 365 Exchange Online',
        result: 'success',
        isLegacyAuth: false,
        clientApp: 'Modern Auth Client',
      });
      break;
    }
    case 'impossible_travel_second_signin_v1': {
      // A distant, unfamiliar location reached implausibly soon after the first sign-in —
      // the relative_timestamp gap between the two kill-chain steps is what makes the
      // Alert Engine's speed calculation (§9.6) come out impossible, not anything here.
      const risky = ctx.rng.pick(RISKY_UNFAMILIAR_COUNTRIES);
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'impossible_travel_second' },
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
    case 'insider_data_exfil_email_v1': {
      const emailId = randomUUID();
      const personalLocalPart =
        (ctx.identity.displayName as string)
          .toLowerCase()
          .replace(/\s+/g, '.') + ctx.rng.intBetween(10, 999);
      const personalAddress = `${personalLocalPart}@${PERSONAL_EMAIL_DOMAIN_FOR_GENERATION}`;
      const filename = ctx.rng.pick(SENSITIVE_ATTACHMENT_FILENAMES);
      const insiderMessageId = `<${randomUUID()}@${ORG_DOMAIN}>`;
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: insiderMessageId,
        direction: 'outbound',
        senderAddress: ctx.identity.userPrincipalName as string,
        senderDisplayName: ctx.identity.displayName as string,
        recipientAddresses: [personalAddress],
        subject: 'Backup copy',
        bodyHtml: '<p>Saving a copy of this for my records.</p>',
        // Genuinely sent by the org's own mail system — not spoofed, unlike every other
        // scenario's ground-truth email (§8.2's evaluateOutboundPersonalEmailRule note). The
        // headers here stay clean on purpose: the Student can't lean on an auth failure and
        // has to reason about the destination and the attachment instead.
        headersRaw: buildEmailHeaders({
          messageId: insiderMessageId,
          senderDisplayName: ctx.identity.displayName as string,
          senderAddress: ctx.identity.userPrincipalName as string,
          recipientAddresses: [personalAddress],
          subject: 'Backup copy',
          occurredAt: ctx.occurredAt,
          receivedChain: [`mail.${ORG_DOMAIN}`],
          authenticationResults: `spf=pass smtp.mailfrom=${ORG_DOMAIN}; dkim=pass; dmarc=pass`,
        }),
        spfResult: 'pass',
        dkimResult: 'pass',
        dmarcResult: 'pass',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      ctx.emailAttachments.push({
        id: randomUUID(),
        emailMessageId: emailId,
        filename,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: ctx.rng.intBetween(20_000, 500_000),
        hashSha256: Array.from({ length: 64 }, () =>
          ctx.rng.intBetween(0, 15).toString(16),
        ).join(''),
        sandboxVerdict: 'benign',
      });
      break;
    }
    case 'malicious_attachment_email_v1': {
      const emailId = randomUUID();
      const malwareMessageId = `<${randomUUID()}@${MALWARE_DELIVERY_DOMAIN}>`;
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: malwareMessageId,
        direction: 'inbound',
        senderAddress: `statements@${MALWARE_DELIVERY_DOMAIN}`,
        senderDisplayName: 'Billing Statements',
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: 'Your Monthly Statement is Ready',
        bodyHtml:
          '<p>Please find your statement attached. Open the document and click "Enable Content" to view the full report.</p>',
        headersRaw: buildEmailHeaders({
          messageId: malwareMessageId,
          senderDisplayName: 'Billing Statements',
          senderAddress: `statements@${MALWARE_DELIVERY_DOMAIN}`,
          recipientAddresses: [ctx.identity.userPrincipalName as string],
          subject: 'Your Monthly Statement is Ready',
          occurredAt: ctx.occurredAt,
          receivedChain: [
            `mail.${MALWARE_DELIVERY_DOMAIN}`,
            'edge-relay-02.example-mx.net',
          ],
          authenticationResults: `spf=fail smtp.mailfrom=${MALWARE_DELIVERY_DOMAIN}; dkim=none; dmarc=fail`,
          returnPath: `bounce@${MALWARE_DELIVERY_DOMAIN}`,
        }),
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      ctx.emailAttachments.push({
        id: randomUUID(),
        emailMessageId: emailId,
        filename: 'Statement_July2026.docm',
        contentType: 'application/vnd.ms-word.document.macroEnabled.12',
        sizeBytes: ctx.rng.intBetween(80_000, 250_000),
        hashSha256: syntheticHash(ctx.rng),
        sandboxVerdict: 'malicious',
      });
      break;
    }
    case 'malicious_process_execution_v1': {
      if (!ctx.device) break;
      const parentGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:parent`,
      );
      const childGuid = deterministicUuidFromSeed(`${ctx.correlationId}:child`);

      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'malicious_macro_parent' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: parentGuid,
        parentProcessGuid: null,
        imagePath:
          'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
        commandLine:
          '"WINWORD.EXE" /n "C:\\Users\\Public\\Downloads\\Statement_July2026.docm"',
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });

      const childOccurredAt = new Date(ctx.occurredAt.getTime() + 30 * 1000);
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: childOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'malicious_macro_child' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: childGuid,
        parentProcessGuid: parentGuid,
        imagePath:
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        commandLine:
          'powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcA',
        hashSha256: syntheticHash(ctx.rng),
        parentImagePath:
          'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });

      const dropOccurredAt = new Date(childOccurredAt.getTime() + 15 * 1000);
      ctx.fileEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: dropOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'dropped_payload' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        action: 'created',
        filePath: 'C:\\Users\\Public\\AppData\\Local\\Temp\\svc_update.exe',
        hashSha256: syntheticHash(ctx.rng),
        processGuid: childGuid,
      });
      break;
    }
    case 'malicious_c2_beacon_v1': {
      if (!ctx.device) break;
      const childGuid = deterministicUuidFromSeed(`${ctx.correlationId}:child`);
      const beaconCount = ctx.rng.intBetween(4, 6);
      for (let i = 0; i < beaconCount; i++) {
        ctx.networkEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 5 * 60 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'c2_beacon' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device.id,
          direction: 'outbound',
          protocol: 'tcp',
          localPort: ctx.rng.intBetween(49152, 65535),
          remoteIp: MALWARE_C2_IP,
          remotePort: 443,
          bytesSent: ctx.rng.intBetween(200, 800),
          bytesReceived: ctx.rng.intBetween(100, 500),
          processGuid: childGuid,
        });
      }
      break;
    }
    case 'legacy_auth_bypass_signin_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'legacy-auth',
      );
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'legacy_auth_bypass' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        sourceIp: attacker.ip,
        sourceCountry: attacker.country,
        sourceCity: attacker.city,
        application: 'Exchange Online IMAP4',
        result: 'success',
        isLegacyAuth: true,
        clientApp: 'IMAP4',
      });
      break;
    }
    case 'legacy_auth_mailbox_collection_v1': {
      // Derived from the same correlation_id as legacy_auth_bypass_signin_v1 (§7.2 stage 4
      // pattern) so the follow-on mailbox syncs agree with the initial bypass's attacker IP.
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'legacy-auth',
      );
      const syncCount = ctx.rng.intBetween(4, 6);
      for (let i = 0; i < syncCount; i++) {
        ctx.signInEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 8 * 60 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'legacy_auth_mailbox_sync' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          identityId: ctx.identity.id,
          sourceIp: attacker.ip,
          sourceCountry: attacker.country,
          sourceCity: attacker.city,
          application: 'Exchange Online IMAP4',
          result: 'success',
          isLegacyAuth: true,
          clientApp: 'IMAP4',
        });
      }
      break;
    }
    case 'legacy_auth_benign_service_v1': {
      // False-positive bait (§8.6): a benign automated mailbox (e.g. a scanner/relay) that
      // happens to use a legacy protocol on an MFA-enforced identity — the same observable
      // shape as the real bypass, so the Student has to actually investigate rather than
      // pattern-match on "legacy auth = compromise."
      ctx.signInEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        raw: { source: 'noise', pattern: 'legacy_auth_benign_service' },
        isGroundTruthEvidence: false,
        identityId: ctx.identity.id,
        sourceIp: syntheticIp(ctx.rng),
        sourceCountry: (ctx.identity.homeCountry as string) ?? 'US',
        sourceCity: 'Unknown',
        application: 'Exchange Online SMTP',
        result: 'success',
        isLegacyAuth: true,
        clientApp: 'SMTP Relay Service',
      });
      break;
    }
    case 'lateral_movement_source_connection_v1': {
      if (!ctx.device) break;
      ctx.networkEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: {
          source: 'ground_truth',
          pattern: 'lateral_movement_smb_connection',
        },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        direction: 'outbound',
        protocol: 'tcp',
        localPort: ctx.rng.intBetween(49152, 65535),
        remoteIp: FILE_SERVER_IP,
        remotePort: 445,
        bytesSent: ctx.rng.intBetween(4_000, 12_000),
        bytesReceived: ctx.rng.intBetween(1_000, 4_000),
        processGuid: null,
      });
      break;
    }
    case 'lateral_movement_remote_exec_v1': {
      if (!ctx.device) break;
      const scmGuid = deterministicUuidFromSeed(`${ctx.correlationId}:scm`);
      const psexecGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:psexecsvc`,
      );
      const cmdGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:remote-cmd`,
      );

      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'lateral_movement_scm' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: scmGuid,
        parentProcessGuid: null,
        imagePath: 'C:\\Windows\\System32\\services.exe',
        commandLine: 'C:\\Windows\\System32\\services.exe',
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'System',
        identityId: ctx.identity.id,
      });

      const psexecOccurredAt = new Date(ctx.occurredAt.getTime() + 5 * 1000);
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: psexecOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'lateral_movement_psexecsvc' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: psexecGuid,
        parentProcessGuid: scmGuid,
        imagePath: 'C:\\Windows\\PSEXESVC.exe',
        commandLine: 'C:\\Windows\\PSEXESVC.exe',
        hashSha256: syntheticHash(ctx.rng),
        parentImagePath: 'C:\\Windows\\System32\\services.exe',
        integrityLevel: 'System',
        identityId: ctx.identity.id,
      });

      const cmdOccurredAt = new Date(psexecOccurredAt.getTime() + 5 * 1000);
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: cmdOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'lateral_movement_remote_cmd' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: cmdGuid,
        parentProcessGuid: psexecGuid,
        imagePath: 'C:\\Windows\\System32\\cmd.exe',
        commandLine: 'cmd.exe /c whoami',
        hashSha256: syntheticHash(ctx.rng),
        parentImagePath: 'C:\\Windows\\PSEXESVC.exe',
        integrityLevel: 'System',
        identityId: ctx.identity.id,
      });
      break;
    }
    case 'mass_file_encryption_v1': {
      if (!ctx.device) break;
      const fileCount = ctx.rng.intBetween(6, 9);
      const paths = ctx.rng.sample(
        SHARED_FILE_PATHS,
        Math.min(fileCount, SHARED_FILE_PATHS.length),
      );
      paths.forEach((path, i) => {
        ctx.fileEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 20 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'mass_encryption' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device!.id,
          action: 'encrypted',
          filePath: `${path}.locked`,
          hashSha256: syntheticHash(ctx.rng),
          processGuid: null,
        });
      });

      ctx.fileEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: new Date(
          ctx.occurredAt.getTime() + paths.length * 20 * 1000 + 10 * 1000,
        ),
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'ransom_note' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        action: 'created',
        filePath: `C:\\Shares\\${RANSOM_NOTE_FILENAME}`,
        hashSha256: syntheticHash(ctx.rng),
        processGuid: null,
      });
      break;
    }
    case 'cloud_malicious_access_key_creation_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'cloud-takeover',
      );
      ctx.cloudEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: {
          source: 'ground_truth',
          pattern: 'malicious_access_key_creation',
        },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        provider: 'aws_style',
        actionName: 'CreateAccessKey',
        resourceId: ctx.identity.userPrincipalName as string,
        sourceIp: attacker.ip,
      });
      break;
    }
    case 'cloud_bucket_enumeration_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'cloud-takeover',
      );
      const actionCount = ctx.rng.intBetween(6, 9);
      for (let i = 0; i < actionCount; i++) {
        ctx.cloudEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 15 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'bucket_enumeration' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          identityId: ctx.identity.id,
          provider: 'aws_style',
          actionName: i === 0 ? 'ListBucket' : 'GetObject',
          resourceId: CLOUD_STORAGE_BUCKET,
          sourceIp: attacker.ip,
        });
      }
      break;
    }
    case 'web_webshell_initial_access_v1': {
      if (!ctx.device) break;
      ctx.httpRequests.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'webshell_initial_access' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        method: 'GET',
        url: WEBSHELL_PATH,
        userAgent: ctx.rng.pick(NON_BROWSER_USER_AGENTS),
        statusCode: 200,
        sourceIp: syntheticIp(ctx.rng),
      });
      break;
    }
    case 'web_webshell_command_burst_v1': {
      if (!ctx.device) break;
      const attacker = attackerProfileFromSeed(ctx.correlationId ?? 'webshell');
      const commandCount = ctx.rng.intBetween(5, 8);
      for (let i = 0; i < commandCount; i++) {
        ctx.httpRequests.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 10 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'webshell_command' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device.id,
          method: 'POST',
          url: WEBSHELL_PATH,
          userAgent: ctx.rng.pick(NON_BROWSER_USER_AGENTS),
          statusCode: 200,
          sourceIp: attacker.ip,
        });
      }
      break;
    }
    case 'web_legitimate_monitoring_v1': {
      // False-positive bait (§8.6): a legitimate uptime/health-check bot also looks like a
      // non-browser client posting to a script path — the same observable shape as the real
      // webshell access, so the Student has to look at the target path, not just the client.
      if (!ctx.device) break;
      ctx.httpRequests.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        raw: { source: 'noise', pattern: 'legitimate_monitoring' },
        isGroundTruthEvidence: false,
        deviceId: ctx.device.id,
        method: 'GET',
        url: LEGITIMATE_SCRIPT_PATH,
        userAgent: MONITORING_USER_AGENT,
        statusCode: 200,
        sourceIp: syntheticIp(ctx.rng),
      });
      break;
    }
    case 'fileless_powershell_backdoor_v1': {
      if (!ctx.device) break;
      const processGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:child`,
      );
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: {
          source: 'ground_truth',
          pattern: 'fileless_powershell_backdoor',
        },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid,
        parentProcessGuid: null,
        imagePath:
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        commandLine: FILELESS_MALWARE_COMMAND_LINE,
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });
      break;
    }
    case 'malware_startup_persistence_v1': {
      if (!ctx.device) break;
      ctx.fileEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'startup_persistence' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        action: 'created',
        filePath: MALWARE_PERSISTENCE_STARTUP_PATH,
        hashSha256: syntheticHash(ctx.rng),
        processGuid: deterministicUuidFromSeed(`${ctx.correlationId}:child`),
      });
      break;
    }
    case 'legitimate_startup_shortcut_v1': {
      // False-positive bait (§8.6): a legitimate app (e.g. a cloud-sync client) also drops a
      // shortcut into the Startup folder on first install — same location, benign intent — so
      // the Student has to look at what the artifact actually is, not just where it landed.
      if (!ctx.device) break;
      ctx.fileEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        raw: { source: 'noise', pattern: 'legitimate_startup_shortcut' },
        isGroundTruthEvidence: false,
        deviceId: ctx.device.id,
        action: 'created',
        filePath: LEGITIMATE_STARTUP_SHORTCUT_PATH,
        hashSha256: syntheticHash(ctx.rng),
        processGuid: null,
      });
      break;
    }
    case 'credential_dumping_lsass_dump_v1': {
      if (!ctx.device) break;
      const guid = deterministicUuidFromSeed(`${ctx.correlationId}:lsass-dump`);
      const targetPid = ctx.rng.intBetween(600, 1400);
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'lsass_credential_dump' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: guid,
        parentProcessGuid: null,
        imagePath: 'C:\\Windows\\System32\\rundll32.exe',
        commandLine: LSASS_DUMP_COMMAND_LINE_TEMPLATE(
          targetPid,
          LSASS_DUMP_FILE_PATH,
        ),
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'High',
        identityId: ctx.identity.id,
      });

      const dumpOccurredAt = new Date(ctx.occurredAt.getTime() + 5 * 1000);
      ctx.fileEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: dumpOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'lsass_dump_file' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        action: 'created',
        filePath: LSASS_DUMP_FILE_PATH,
        hashSha256: syntheticHash(ctx.rng),
        processGuid: guid,
      });
      break;
    }
    case 'insider_bulk_usb_copy_v1': {
      if (!ctx.device) break;
      const paths = ctx.rng.sample(
        SHARED_FILE_PATHS,
        Math.min(6, SHARED_FILE_PATHS.length),
      );
      paths.forEach((path, i) => {
        const filename = path.split('\\').pop();
        ctx.fileEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 15 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'insider_usb_copy' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device!.id,
          action: 'created',
          filePath: `${REMOVABLE_MEDIA_DRIVE}${filename}`,
          hashSha256: syntheticHash(ctx.rng),
          processGuid: null,
        });
      });
      break;
    }
    case 'insider_source_file_cleanup_v1': {
      if (!ctx.device) break;
      const paths = ctx.rng.sample(
        SHARED_FILE_PATHS,
        Math.min(6, SHARED_FILE_PATHS.length),
      );
      paths.forEach((path, i) => {
        ctx.fileEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 15 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'insider_source_cleanup' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device!.id,
          action: 'deleted',
          filePath: path,
          hashSha256: syntheticHash(ctx.rng),
          processGuid: null,
        });
      });
      break;
    }
    case 'cloud_bucket_public_exposure_v1': {
      ctx.cloudEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'bucket_public_exposure' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        provider: 'aws_style',
        actionName: 'PutBucketPolicy',
        resourceId: CLOUD_STORAGE_BUCKET_CUSTOMER_EXPORTS,
        sourceIp: syntheticIp(ctx.rng),
      });
      break;
    }
    case 'cloud_bucket_public_access_burst_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'bucket-exposure',
      );
      const actionCount = ctx.rng.intBetween(6, 9);
      for (let i = 0; i < actionCount; i++) {
        ctx.cloudEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 12 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'bucket_public_access' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          identityId: ctx.identity.id,
          provider: 'aws_style',
          actionName: i === 0 ? 'ListBucket' : 'GetObject',
          resourceId: CLOUD_STORAGE_BUCKET_CUSTOMER_EXPORTS,
          sourceIp: attacker.ip,
        });
      }
      break;
    }
    case 'web_sqli_probe_burst_v1': {
      if (!ctx.device) break;
      const attacker = attackerProfileFromSeed(ctx.correlationId ?? 'sqli');
      SQLI_PROBE_PAYLOADS.forEach((payload, i) => {
        ctx.httpRequests.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 8 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'sqli_probe' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device!.id,
          method: 'GET',
          url: `${WEB_SQLI_ENDPOINT_PATH}?id=${encodeURIComponent(payload)}`,
          userAgent: ctx.rng.pick(NON_BROWSER_USER_AGENTS),
          statusCode: i % 2 === 0 ? 200 : 500,
          sourceIp: attacker.ip,
        });
      });
      break;
    }
    case 'web_sqli_data_exfil_v1': {
      if (!ctx.device) break;
      const attacker = attackerProfileFromSeed(ctx.correlationId ?? 'sqli');
      ctx.httpRequests.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'sqli_data_exfil' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        method: 'GET',
        url: `${WEB_SQLI_ENDPOINT_PATH}?id=${encodeURIComponent(SQLI_UNION_EXFIL_PAYLOAD)}`,
        userAgent: ctx.rng.pick(NON_BROWSER_USER_AGENTS),
        statusCode: 200,
        sourceIp: attacker.ip,
      });
      break;
    }
    case 'ransomware_data_staging_exfil_v1': {
      if (!ctx.device) break;
      const beaconCount = ctx.rng.intBetween(4, 6);
      for (let i = 0; i < beaconCount; i++) {
        ctx.networkEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 3 * 60 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'ransomware_data_staging' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device.id,
          direction: 'outbound',
          protocol: 'tcp',
          localPort: ctx.rng.intBetween(49152, 65535),
          remoteIp: RANSOMWARE_EXFIL_IP,
          remotePort: 443,
          bytesSent: ctx.rng.intBetween(50_000_000, 200_000_000),
          bytesReceived: ctx.rng.intBetween(500, 2_000),
          processGuid: null,
        });
      }
      break;
    }
    case 'trojan_installer_execution_v1': {
      if (!ctx.device) break;
      const installerGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:installer`,
      );
      const payloadGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:payload`,
      );

      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'trojan_installer_launch' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: installerGuid,
        parentProcessGuid: null,
        imagePath: `C:\\Users\\Public\\Downloads\\${TROJAN_INSTALLER_FILENAME}`,
        commandLine: `"${TROJAN_INSTALLER_FILENAME}" /S`,
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });

      const payloadOccurredAt = new Date(ctx.occurredAt.getTime() + 20 * 1000);
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: payloadOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'trojan_payload_launch' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: payloadGuid,
        parentProcessGuid: installerGuid,
        imagePath: TROJAN_DROPPED_PAYLOAD_PATH,
        commandLine: `"${TROJAN_DROPPED_PAYLOAD_PATH}"`,
        hashSha256: syntheticHash(ctx.rng),
        parentImagePath: `C:\\Users\\Public\\Downloads\\${TROJAN_INSTALLER_FILENAME}`,
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });

      const dropOccurredAt = new Date(payloadOccurredAt.getTime() + 5 * 1000);
      ctx.fileEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: dropOccurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'trojan_payload_dropped' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        action: 'created',
        filePath: TROJAN_DROPPED_PAYLOAD_PATH,
        hashSha256: syntheticHash(ctx.rng),
        processGuid: installerGuid,
      });
      break;
    }
    case 'malware_scheduled_task_persistence_v1': {
      if (!ctx.device) break;
      const payloadGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:payload`,
      );
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'scheduled_task_persistence' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: deterministicUuidFromSeed(`${ctx.correlationId}:schtasks`),
        parentProcessGuid: payloadGuid,
        imagePath: 'C:\\Windows\\System32\\schtasks.exe',
        commandLine: SCHEDULED_TASK_COMMAND_LINE,
        hashSha256: syntheticHash(ctx.rng),
        parentImagePath: TROJAN_DROPPED_PAYLOAD_PATH,
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });
      break;
    }
    case 'oauth_consent_phishing_email_v1': {
      const emailId = randomUUID();
      const oauthMessageId = `<${randomUUID()}@${OAUTH_PHISHING_DOMAIN}>`;
      ctx.emailMessages.push({
        id: emailId,
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        messageId: oauthMessageId,
        direction: 'inbound',
        senderAddress: `no-reply@${OAUTH_PHISHING_DOMAIN}`,
        senderDisplayName: 'Microsoft 365 App Permissions',
        recipientAddresses: [ctx.identity.userPrincipalName as string],
        subject: 'Action Required: Reconnect Your Mailbox to Restore Sync',
        bodyHtml:
          '<p>Your mailbox sync was interrupted. To restore access, please reconnect your account and grant permission to the Office Sync Helper app.</p>',
        headersRaw: buildEmailHeaders({
          messageId: oauthMessageId,
          senderDisplayName: 'Microsoft 365 App Permissions',
          senderAddress: `no-reply@${OAUTH_PHISHING_DOMAIN}`,
          recipientAddresses: [ctx.identity.userPrincipalName as string],
          subject: 'Action Required: Reconnect Your Mailbox to Restore Sync',
          occurredAt: ctx.occurredAt,
          receivedChain: [
            `mail.${OAUTH_PHISHING_DOMAIN}`,
            'edge-relay-04.example-mx.net',
          ],
          authenticationResults: `spf=fail smtp.mailfrom=${OAUTH_PHISHING_DOMAIN}; dkim=none; dmarc=fail`,
          returnPath: `bounce@${OAUTH_PHISHING_DOMAIN}`,
        }),
        spfResult: 'fail',
        dkimResult: 'none',
        dmarcResult: 'fail',
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
      });
      ctx.emailUrls.push({
        id: randomUUID(),
        emailMessageId: emailId,
        url: `https://${OAUTH_PHISHING_DOMAIN}/oauth/authorize?client_id=office-sync-helper&scope=Mail.Read`,
        displayText: 'Reconnect Mailbox',
        reputation: 'malicious',
        isRewrittenBySafeLinks: false,
      });
      break;
    }
    case 'oauth_illicit_consent_grant_v1': {
      // The consent click itself is performed by the tricked user from their own browser, so
      // (deliberately, unlike the mailbox-access burst below) this event uses the identity's
      // own synthetic IP rather than an attacker profile — the Student has to notice the
      // unfamiliar app name and action, not just an unfamiliar IP.
      ctx.cloudEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'oauth_illicit_consent_grant' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        identityId: ctx.identity.id,
        provider: 'saas',
        actionName: 'ConsentToApplication',
        resourceId: MALICIOUS_OAUTH_APP_NAME,
        sourceIp: syntheticIp(ctx.rng),
      });
      break;
    }
    case 'oauth_app_mailbox_exfil_v1': {
      const attacker = attackerProfileFromSeed(
        ctx.correlationId ?? 'oauth-consent',
      );
      const accessCount = ctx.rng.intBetween(5, 8);
      for (let i = 0; i < accessCount; i++) {
        ctx.cloudEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 20 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'oauth_app_mailbox_access' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          identityId: ctx.identity.id,
          provider: 'saas',
          actionName: 'MailItemsAccessed',
          resourceId: MALICIOUS_OAUTH_APP_NAME,
          sourceIp: attacker.ip,
        });
      }
      break;
    }
    case 'kerberoasting_tgs_request_v1': {
      if (!ctx.device) break;
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'kerberoasting_tgs_request' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: deterministicUuidFromSeed(
          `${ctx.correlationId}:kerberoast`,
        ),
        parentProcessGuid: null,
        imagePath: KERBEROASTING_TOOL_PATH,
        commandLine: KERBEROASTING_COMMAND_LINE,
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });
      break;
    }
    case 'dns_backdoor_execution_v1': {
      if (!ctx.device) break;
      ctx.processEvents.push({
        id: randomUUID(),
        sessionId: ctx.sessionId,
        occurredAt: ctx.occurredAt,
        correlationId: ctx.correlationId,
        raw: { source: 'ground_truth', pattern: 'dns_backdoor_execution' },
        isGroundTruthEvidence: ctx.isGroundTruthEvidence,
        mitreTechniqueId: ctx.mitreTechniqueId,
        deviceId: ctx.device.id,
        processGuid: deterministicUuidFromSeed(
          `${ctx.correlationId}:dns-backdoor`,
        ),
        parentProcessGuid: null,
        imagePath: DNS_BACKDOOR_TOOL_PATH,
        commandLine: DNS_BACKDOOR_COMMAND_LINE,
        hashSha256: syntheticHash(ctx.rng),
        integrityLevel: 'Medium',
        identityId: ctx.identity.id,
      });
      break;
    }
    case 'dns_tunnel_c2_beacon_v1': {
      if (!ctx.device) break;
      const processGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:dns-backdoor`,
      );
      const queryCount = ctx.rng.intBetween(10, 14);
      for (let i = 0; i < queryCount; i++) {
        ctx.networkEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 90 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'dns_tunnel_c2_beacon' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device.id,
          direction: 'outbound',
          protocol: 'udp',
          localPort: ctx.rng.intBetween(49152, 65535),
          remoteIp: DNS_TUNNEL_C2_IP,
          remotePort: 53,
          bytesSent: ctx.rng.intBetween(60, 120),
          bytesReceived: ctx.rng.intBetween(60, 120),
          processGuid,
        });
      }
      break;
    }
    case 'dns_tunnel_data_exfil_v1': {
      if (!ctx.device) break;
      const processGuid = deterministicUuidFromSeed(
        `${ctx.correlationId}:dns-backdoor`,
      );
      const queryCount = ctx.rng.intBetween(20, 28);
      for (let i = 0; i < queryCount; i++) {
        ctx.networkEvents.push({
          id: randomUUID(),
          sessionId: ctx.sessionId,
          occurredAt: new Date(ctx.occurredAt.getTime() + i * 20 * 1000),
          correlationId: ctx.correlationId,
          raw: { source: 'ground_truth', pattern: 'dns_tunnel_data_exfil' },
          isGroundTruthEvidence: ctx.isGroundTruthEvidence,
          mitreTechniqueId: ctx.mitreTechniqueId,
          deviceId: ctx.device.id,
          direction: 'outbound',
          protocol: 'udp',
          localPort: ctx.rng.intBetween(49152, 65535),
          remoteIp: DNS_TUNNEL_C2_IP,
          remotePort: 53,
          bytesSent: ctx.rng.intBetween(400, 900),
          bytesReceived: ctx.rng.intBetween(40, 90),
          processGuid,
        });
      }
      break;
    }
    default:
      break;
  }
}

function syntheticIp(rng: SeededRng): string {
  return `${rng.intBetween(20, 223)}.${rng.intBetween(0, 255)}.${rng.intBetween(0, 255)}.${rng.intBetween(1, 254)}`;
}

function syntheticHash(rng: SeededRng): string {
  return Array.from({ length: 64 }, () =>
    rng.intBetween(0, 15).toString(16),
  ).join('');
}

function attackerProfileFromSeed(seed: string): {
  ip: string;
  country: string;
  city: string;
} {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const country =
    RISKY_UNFAMILIAR_COUNTRIES[hash % RISKY_UNFAMILIAR_COUNTRIES.length];
  const ip = `${45 + (hash % 150)}.${(hash >>> 3) % 256}.${(hash >>> 7) % 256}.${1 + ((hash >>> 11) % 253)}`;
  return { ip, country: country.country, city: country.city };
}

// Deterministic UUID-shaped identifier derived from a string seed, so two independent
// kill-chain steps (e.g. process execution and its later C2 beacon) can agree on the same
// process_guid without sharing mutable state (§7.2 stage 4 pattern, same idea as
// attackerProfileFromSeed above).
function deterministicUuidFromSeed(seed: string): string {
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < seed.length; i++) {
    h1 = (h1 * 31 + seed.charCodeAt(i)) >>> 0;
    h2 = (h2 * 131 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = (n: number, len: number) =>
    (n >>> 0).toString(16).padStart(8, '0').slice(0, len);
  return `${hex(h1, 8)}-${hex(h2, 4)}-4${hex(h1 ^ h2, 3)}-8${hex(h2 ^ h1, 3)}-${hex(h1, 6)}${hex(h2, 6)}`;
}
