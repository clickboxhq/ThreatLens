import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /**
   * The text/plain alternative. Optional only so a caller that genuinely has nothing to say
   * in text is not forced to invent it — every template supplies one, and an HTML-only
   * message is a spam signal both Gmail and Outlook weight.
   */
  text?: string;
}

// Resend (https://resend.com), chosen for zero-SMTP-config setup — one API key, no host/port/
// TLS plumbing. Falls back to logging the content instead of sending when RESEND_API_KEY isn't
// configured, so local dev, CI, and any environment that hasn't set it up keep working exactly
// as before rather than failing every signup/reset request.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send({ to, subject, html, text }: SendEmailInput): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — logging email instead of sending. To: ${to}, Subject: ${subject}, Body: ${html}`,
      );
      return;
    }

    const from =
      this.config.get<string>('EMAIL_FROM') ??
      'ThreatLens <onboarding@resend.dev>';

    // A transient provider outage or bad key shouldn't fail the caller's own operation
    // (account creation, a reset request) — both have their own resend/retry path, and
    // silently swallowing here (after logging) beats a 500 on signup over an email hiccup.
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // Omitted rather than sent empty when absent: Resend treats an empty text part as a
        // real one, which is worse than having none.
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
          ...(text ? { text } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(
          `Resend API returned ${res.status} sending to ${to}: ${body}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${(err as Error).message}`,
      );
    }
  }
}
