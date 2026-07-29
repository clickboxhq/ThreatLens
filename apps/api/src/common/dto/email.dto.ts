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

// §15.6/§11.10: strip active content before rendered HTML ever leaves the API, even though
// all body content is authored by the content team, not untrusted third-party input.
function sanitizeHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on[a-z]+="[^"]*"/gi, '');
}
