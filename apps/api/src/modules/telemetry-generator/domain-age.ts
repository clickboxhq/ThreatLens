import {
  ORG_DOMAIN,
  MALICIOUS_DOMAIN,
  LOOKALIKE_INTERNAL_DOMAIN,
  EXEC_LOOKALIKE_DOMAIN,
  OAUTH_PHISHING_DOMAIN,
  MALWARE_DELIVERY_DOMAIN,
  MALWARE_C2_DOMAIN,
} from './templates';

// Recommendation 04 from the SOC-tool research. Defender for Office 365 and every commercial
// mail-security product surface sender domain age, because it is one of the few phishing
// signals that is both objective and hard for an adversary to fake: campaign infrastructure is
// typically registered days before it is used, while a genuine corporate domain has years of
// history behind it. A learner who forms the habit of asking "how old is this domain?" carries
// it to any tool they ever touch.
//
// Registration dates are derived deterministically from the world clock so a session generated
// from the same seed always reports the same age — the learner and their instructor must see
// identical evidence.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Domains that exist to send one campaign. Days old, not years. */
const RECENTLY_REGISTERED_DAYS: Record<string, number> = {
  [MALICIOUS_DOMAIN]: 6,
  [EXEC_LOOKALIKE_DOMAIN]: 11,
  [LOOKALIKE_INTERNAL_DOMAIN]: 4,
  [OAUTH_PHISHING_DOMAIN]: 9,
  [MALWARE_DELIVERY_DOMAIN]: 3,
  [MALWARE_C2_DOMAIN]: 17,
};

/** Domains with real history. Years, expressed in days. */
const ESTABLISHED_DOMAIN_YEARS: Record<string, number> = {
  [ORG_DOMAIN]: 14,
  'gmail.com': 21,
  'outlook.com': 19,
  'microsoft.com': 32,
  'salesforce.com': 26,
  'workday.com': 20,
  'dropbox.com': 18,
  'docusign.com': 22,
};

/**
 * The registration date to report for a sending domain, relative to the session's world clock.
 *
 * Returns null for anything not explicitly classified rather than guessing. An unknown
 * registration date is a truthful answer that a real resolver also gives, and inventing a
 * plausible-looking date for every domain would quietly turn a genuine signal into noise —
 * worse, it would teach learners to trust a number that means nothing.
 */
export function senderDomainRegisteredAt(
  senderAddress: string,
  worldNow: Date,
): Date | null {
  const domain = senderAddress.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const recentDays = RECENTLY_REGISTERED_DAYS[domain];
  if (recentDays !== undefined) {
    return new Date(worldNow.getTime() - recentDays * DAY_MS);
  }

  const establishedYears = ESTABLISHED_DOMAIN_YEARS[domain];
  if (establishedYears !== undefined) {
    return new Date(worldNow.getTime() - establishedYears * 365 * DAY_MS);
  }

  return null;
}
