import type { ScenarioCategory } from '@prisma/client';

// Recommendation 03 from the SOC-tool research: Microsoft Sentinel attaches a task checklist to
// an incident so an analyst works a defined procedure rather than improvising from raw
// telemetry, and Defender/InsightIDR both structure triage the same way. Here the checklist is
// the teaching artefact — it is the transferable *method*, which is the thing a learner should
// still have when the scenario, the tooling and the employer have all changed.
//
// Hard constraint, identical to the insight prompts: a task states what to GO AND DO, never
// what will be found. "Check whether authentication controls were satisfied" is procedure;
// "Note that MFA was not enforced" would be the answer key. These are derived purely from the
// scenario's category — never from its ground-truth definition — so there is no path by which
// the answer could leak into them. investigation-tasks.spec.ts enforces both properties.

export interface InvestigationTask {
  key: string;
  label: string;
  detail: string;
}

// Every investigation ends the same way regardless of category: commit to a verdict you can
// defend from what you pinned, then propose action proportionate to it. Kept as one shared
// tail so the closing discipline reads identically across all eight categories.
const CLOSING_TASKS: InvestigationTask[] = [
  {
    key: 'reach-verdict',
    label: 'Reach a verdict you can defend from your evidence',
    detail:
      'State what you believe happened, and check that every claim in it is supported by something you pinned. If a claim has no evidence behind it, it is an assumption — either go and evidence it, or drop it.',
  },
  {
    key: 'recommend-containment',
    label: 'Recommend containment proportionate to the finding',
    detail:
      'Match the action to what you actually established. Over-containment has a real cost to the business; under-containment leaves the problem in place. A benign finding warrants no action at all, and saying so is a legitimate outcome.',
  },
];

const IDENTITY_TASKS: InvestigationTask[] = [
  {
    key: 'establish-baseline',
    label: 'Establish what normal looks like for this account',
    detail:
      'Before judging the activity in question, learn the account usual pattern: which countries it signs in from, which applications it uses, and over what period of history. You cannot call something anomalous until you know what it is anomalous against.',
  },
  {
    key: 'isolate-anomaly',
    label: 'Identify precisely what differs from that baseline',
    detail:
      'Name the specific difference — location, time, application, client, or frequency. "Something looks odd" is not a finding; "this is the only sign-in from this country in thirty days" is.',
  },
  {
    key: 'check-auth-controls',
    label: 'Check whether authentication controls were satisfied',
    detail:
      'Look at the MFA registration and enforcement on the account, and at whether the authentication used a protocol capable of bypassing it. This often explains how access was possible at all.',
  },
  {
    key: 'check-account-changes',
    label: 'Look for changes made to the account itself',
    detail:
      'Review the directory audit trail for credential resets, new MFA methods, role or group changes, and mailbox rules. Changes here are what separate a single unauthorised sign-in from durable, ongoing access.',
  },
  {
    key: 'check-blast-radius',
    label: 'Determine whether any other account shows the same pattern',
    detail:
      'A pattern affecting one account and a pattern affecting twenty are different incidents with different responses. Check before assuming the scope you were handed is the real scope.',
  },
  ...CLOSING_TASKS,
];

const EMAIL_TASKS: InvestigationTask[] = [
  {
    key: 'verify-authentication',
    label: 'Verify the sender authentication results',
    detail:
      'Read SPF, DKIM and DMARC from the headers. These record whether the sending server was actually authorised to send for the domain it claims — the single most objective signal available on an email.',
  },
  {
    key: 'inspect-sender-domain',
    label: 'Compare the sender domain against the real corporate domain',
    detail:
      'Read the domain character by character rather than at a glance. Lookalike domains are built specifically to survive the glance, and the display name is free text chosen by whoever sent the message and can say anything at all.',
  },
  {
    key: 'inspect-routing-headers',
    label: 'Check where a reply would actually go',
    detail:
      'Compare Reply-To and Return-Path against the From address. A reply address pointing somewhere other than the apparent sender means the conversation is being steered away from the person it appears to be with.',
  },
  {
    key: 'assess-payload',
    label: 'Assess the payload — or establish that there is none',
    detail:
      'Examine links and attachments. An email carrying neither is not automatically safe: where the request itself is the payload, there is nothing technical to detonate and the request itself is the whole of it.',
  },
  {
    key: 'scope-recipients',
    label: 'Establish who else received it',
    detail:
      'One recipient suggests targeting; many suggest a campaign. This changes both the severity and who else you need to warn.',
  },
  {
    key: 'check-engagement',
    label: 'Determine whether anyone acted on it',
    detail:
      'Delivery and engagement are different events with very different consequences. Look for evidence that a link was opened or a reply sent — a delivered email nobody touched is a near miss, not an incident.',
  },
  ...CLOSING_TASKS,
];

const ENDPOINT_TASKS: InvestigationTask[] = [
  {
    key: 'establish-execution',
    label: 'Establish what executed, and what launched it',
    detail:
      'Read the process and its parent. Lineage is usually more informative than the process itself — a trusted binary launched by something that had no business launching it is the classic tell.',
  },
  {
    key: 'inspect-command-line',
    label: 'Read the full command line, not just the image name',
    detail:
      'The image name says which program ran; the arguments say what it was told to do. Living-off-the-land techniques rely on legitimate binaries, so the arguments are where the intent actually lives.',
  },
  {
    key: 'check-privilege',
    label: 'Check the privilege and integrity level it ran at',
    detail:
      'Establish what the process was actually able to reach. Privilege determines the ceiling on impact, and an elevation between parent and child is itself worth explaining.',
  },
  {
    key: 'trace-activity',
    label: 'Trace what the process touched',
    detail:
      'Follow the files it wrote and the connections it opened. This is where intent becomes visible — execution alone tells you something ran, not what it was for.',
  },
  {
    key: 'check-persistence',
    label: 'Look for persistence',
    detail:
      'Check startup entries, scheduled tasks and services. Persistence is what decides whether rebooting the machine ends the problem or merely pauses it.',
  },
  {
    key: 'check-blast-radius',
    label: 'Determine whether other devices show the same activity',
    detail:
      'Check whether the pattern is confined to this host. Containing one device while the same activity runs on ten others is a response that feels decisive and achieves nothing.',
  },
  ...CLOSING_TASKS,
];

const CLOUD_TASKS: InvestigationTask[] = [
  {
    key: 'establish-actor',
    label: 'Establish which identity performed the action',
    detail:
      'Cloud control-plane events are attributable. Start from the actor, because everything else you conclude depends on whether that identity had any business doing this.',
  },
  {
    key: 'baseline-actor',
    label: 'Establish whether that identity normally does this',
    detail:
      'An administrator creating a key is routine; an account that has never touched the console doing the same thing is not. The action is identical — the baseline is what distinguishes them.',
  },
  {
    key: 'assess-resource',
    label: 'Assess what the action exposed or changed',
    detail:
      'Identify the resource and what the change means for who can now reach it. The severity of a permission change is a property of the data behind it.',
  },
  {
    key: 'check-new-access',
    label: 'Look for new credentials, keys or grants',
    detail:
      'Check whether the activity created a durable means of return — an access key, a service principal, a consent grant. This is the cloud equivalent of persistence.',
  },
  {
    key: 'check-blast-radius',
    label: 'Determine what else that identity touched',
    detail:
      'Review the wider control-plane activity for that identity in the same window. A single event is rarely the whole story.',
  },
  ...CLOSING_TASKS,
];

const WEB_TASKS: InvestigationTask[] = [
  {
    key: 'establish-request',
    label: 'Establish what was requested and how the server responded',
    detail:
      'Read the method, path and status code together. The response code tells you whether an attempt succeeded, which is often the difference between an attempt and an incident.',
  },
  {
    key: 'baseline-traffic',
    label: 'Distinguish it from normal traffic to the same server',
    detail:
      'Public-facing servers are probed constantly. Establish what routine traffic looks like here, so you can tell background noise from something that actually landed.',
  },
  {
    key: 'assess-payload',
    label: 'Assess the request payload',
    detail:
      'Examine the parameters and body for structure rather than literal content — a payload can be encoded, but its shape is harder to hide.',
  },
  {
    key: 'check-followup',
    label: 'Determine what happened after the initial request',
    detail:
      'Follow what the server did next. Initial access is only interesting because of what follows it; a probe that achieved nothing and a foothold that led to execution look similar at the first request.',
  },
  {
    key: 'check-blast-radius',
    label: 'Establish what the server could reach',
    detail:
      'Consider what someone in control of this host would be able to reach next. A public-facing server is usually a stepping stone rather than the objective.',
  },
  ...CLOSING_TASKS,
];

const INSIDER_TASKS: InvestigationTask[] = [
  {
    key: 'establish-activity',
    label: 'Establish exactly what was accessed, moved or sent',
    detail:
      'Be specific about the data and the channel. Insider cases turn on detail, and a vague account of what happened cannot support any decision about a named colleague.',
  },
  {
    key: 'baseline-user',
    label: 'Establish whether this fits how they normally work',
    detail:
      'Almost every action in an insider case is one the person is authorised to take. What matters is whether the volume, timing and destination fit how they normally do their job.',
  },
  {
    key: 'assess-sensitivity',
    label: 'Assess the sensitivity and volume of what moved',
    detail:
      'Judge the material itself. Routine access to routine data is not an incident regardless of how the activity was surfaced.',
  },
  {
    key: 'assess-destination',
    label: 'Establish where it went',
    detail:
      'A sanctioned internal location and personal or removable storage carry very different implications for the same file.',
  },
  {
    key: 'check-concealment',
    label: 'Look for signs the activity was concealed',
    detail:
      'Check for deletion, renaming or clean-up around the activity. Concealment speaks to intent in a way the access itself does not — and its absence is equally worth recording.',
  },
  ...CLOSING_TASKS,
];

// malware and ransomware are investigated with endpoint method; the distinction lives in the
// scenario narrative and the scoring rubric, not in how an analyst works the evidence.
const TASKS_BY_CATEGORY: Record<ScenarioCategory, InvestigationTask[]> = {
  identity: IDENTITY_TASKS,
  email: EMAIL_TASKS,
  endpoint: ENDPOINT_TASKS,
  malware: ENDPOINT_TASKS,
  ransomware: ENDPOINT_TASKS,
  cloud: CLOUD_TASKS,
  web: WEB_TASKS,
  insider_threat: INSIDER_TASKS,
};

export function tasksForCategory(
  category: ScenarioCategory,
): InvestigationTask[] {
  return TASKS_BY_CATEGORY[category] ?? IDENTITY_TASKS;
}

export const ALL_TASK_KEYS: string[] = [
  ...new Set(
    Object.values(TASKS_BY_CATEGORY).flatMap((tasks) =>
      tasks.map((t) => t.key),
    ),
  ),
];
