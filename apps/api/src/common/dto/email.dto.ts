import * as sanitizeHtmlLib from 'sanitize-html';
import type { EmailAttachment, EmailMessage, EmailUrl } from '@prisma/client';

export interface StudentEmailAttachmentDto {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  hashSha256: string;
  sandboxVerdict: string;
}

export interface StudentEmailUrlDto {
  id: string;
  url: string;
  displayText: string;
  reputation: string;
  isRewrittenBySafeLinks: boolean;
}

// §18.3: excludes isGroundTruthEvidence, mitreTechniqueId, correlationId.
export interface StudentEmailDto {
  id: string;
  occurredAt: Date;
  messageId: string;
  direction: string;
  senderAddress: string;
  senderDisplayName: string;
  recipientAddresses: string[];
  subject: string;
  bodyHtml: string;
  headersRaw: unknown;
  spfResult: string;
  dkimResult: string;
  dmarcResult: string;
  senderDomainRegisteredAt: Date | null;
  attachments: StudentEmailAttachmentDto[];
  urls: StudentEmailUrlDto[];
}

export function toStudentEmailDto(
  email: EmailMessage & { attachments?: EmailAttachment[]; urls?: EmailUrl[] },
): StudentEmailDto {
  return {
    id: email.id,
    occurredAt: email.occurredAt,
    messageId: email.messageId,
    direction: email.direction,
    senderAddress: email.senderAddress,
    senderDisplayName: email.senderDisplayName,
    recipientAddresses: email.recipientAddresses,
    subject: email.subject,
    bodyHtml: sanitizeHtml(email.bodyHtml),
    headersRaw: email.headersRaw,
    spfResult: email.spfResult,
    dkimResult: email.dkimResult,
    dmarcResult: email.dmarcResult,
    senderDomainRegisteredAt: email.senderDomainRegisteredAt,
    attachments: (email.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      hashSha256: a.hashSha256,
      sandboxVerdict: a.sandboxVerdict,
    })),
    urls: (email.urls ?? []).map((u) => ({
      id: u.id,
      url: u.url,
      displayText: u.displayText,
      reputation: u.reputation,
      isRewrittenBySafeLinks: u.isRewrittenBySafeLinks,
    })),
  };
}

// §15.6/§11.10: strip active content before rendered HTML ever leaves the API. Today's scenario
// content is authored by the content team, not a third party, but the frontend renders this
// field via dangerouslySetInnerHTML (§17), and future scenario-authoring tooling (§12.1) would
// let instructors author this content directly — so this is real sanitization against a real
// sink, not theater, using an allowlist library rather than a regex that's trivial to bypass
// (e.g. a regex can't safely catch every dangerous tag/attribute/URL-scheme combination).
const SANITIZE_HTML_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'a',
    'ul',
    'ol',
    'li',
    'span',
    'div',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'img',
  ],
  allowedAttributes: {
    a: ['href'],
    img: ['src', 'alt'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_HTML_OPTIONS);
}
