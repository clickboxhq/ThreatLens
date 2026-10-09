import {
  verificationEmail,
  welcomeEmail,
  passwordResetEmail,
  organizationInviteEmail,
  organizationMemberJoinedEmail,
  organizationAnnouncementEmail,
  cohortInviteEmail,
  escapeHtml,
} from './email-templates';
import type { RenderedEmail } from './email-templates';

const URL = 'https://threatlensapp.com/verify-email/abc123';

describe('email templates', () => {
  describe('display names in the welcome email', () => {
    // Two failure directions, and fixing one is what causes the other. Escaping the name here
    // and again in renderEmail showed a reader called O'Brien their own name as "O&#39;Brien";
    // dropping the escape entirely would let a display name inject markup into an email that
    // the reader's client renders before they can inspect it.
    it('renders an apostrophe in a name as the character, not an entity', () => {
      const { html } = welcomeEmail({
        displayName: "O'Brien",
        appUrl: 'https://x.test',
      });
      expect(html).toContain('Welcome to ThreatLens, O&#39;Brien');
      expect(html).not.toContain('O&amp;#39;Brien');
    });

    it('neutralises markup in a display name', () => {
      const { html } = welcomeEmail({
        displayName: '<script>alert(1)</script>',
        appUrl: 'https://x.test',
      });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('uses the first name only, and falls back when there is not one', () => {
      expect(
        welcomeEmail({ displayName: 'Dana Okafor', appUrl: 'x' }).html,
      ).toContain('Welcome to ThreatLens, Dana');
      expect(welcomeEmail({ displayName: '   ', appUrl: 'x' }).html).toContain(
        'Welcome to ThreatLens, there',
      );
    });

    it('carries the getting-started steps, the CTA and the ClickBox sign-off', () => {
      const { html } = welcomeEmail({
        displayName: 'Dana',
        appUrl: 'https://threatlensapp.com/app/scenarios',
      });
      expect(html).toContain('<ol');
      expect(html).toContain('Submit your verdict');
      expect(html).toContain('Start your first investigation');
      expect(html).toContain('https://threatlensapp.com/app/scenarios');
      expect(html).toContain('A ClickBox product');
    });
  });

  describe('organization invitation email', () => {
    const input = {
      orgName: 'ClickBox',
      inviterName: 'Ada Admin',
      role: 'student',
      inviteUrl: 'https://threatlensapp.com/accept-invite/tok123',
    };

    it('is dynamic — nothing about ClickBox specifically is hardcoded', () => {
      const { subject, html } = organizationInviteEmail({
        ...input,
        orgName: 'A Totally Different Org',
        inviterName: 'Someone Else',
        role: 'instructor',
      });
      expect(subject).toContain('A Totally Different Org');
      expect(html).toContain('A Totally Different Org');
      expect(html).toContain('Someone Else');
      expect(html).toContain('Instructor');
      expect(html).not.toContain('ClickBox');
    });

    it('carries the org, role, inviter, CTA, and expiry', () => {
      const { subject, html } = organizationInviteEmail(input);
      expect(subject).toContain('ClickBox');
      expect(html).toContain('ClickBox');
      expect(html).toContain('Ada Admin');
      expect(html).toContain('Student');
      expect(html).toContain('Accept Invitation');
      expect(html).toContain('This invitation expires in 7 days.');
      expect(html).toContain(input.inviteUrl);
    });

    it('includes a security notice for an unexpected invite', () => {
      const { html } = organizationInviteEmail(input);
      expect(html.toLowerCase()).toContain('if you were not expecting');
    });

    it('neutralises markup in an inviter or org name', () => {
      const { html } = organizationInviteEmail({
        ...input,
        orgName: '<img src=x onerror=alert(1)>',
        inviterName: '<script>alert(1)</script>',
      });
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).not.toContain('<script>alert(1)</script>');
    });
  });

  describe('structure every client depends on', () => {
    it.each([
      ['verification', verificationEmail(URL).html],
      ['welcome', welcomeEmail({ displayName: 'Dana', appUrl: URL }).html],
      ['password reset', passwordResetEmail(URL).html],
      [
        'organization invite',
        organizationInviteEmail({
          orgName: 'ClickBox',
          inviterName: 'Ada Admin',
          role: 'student',
          inviteUrl: URL,
        }).html,
      ],
    ])('%s email is a complete table-based document', (_name, html) => {
      expect(html).toContain('<!doctype html>');
      // Outlook renders through Word: no flexbox or grid survives, so layout has to be tables.
      expect(html).toContain('role="presentation"');
      expect(html).not.toMatch(/display:\s*(flex|grid)/);
      // External assets are blocked by default in most clients.
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<link');
      // A preheader, or the client pulls the first body sentence into the preview line.
      expect(html).toMatch(/max-height:0/);
    });

    it('puts the link in both the button and a copyable fallback', () => {
      // A button that a client mangles leaves the reader with no way through at all.
      const { html } = verificationEmail(URL);
      expect(html.split(URL).length - 1).toBeGreaterThanOrEqual(2);
    });

    it('gives every email a subject', () => {
      expect(verificationEmail(URL).subject).toBe(
        'Verify your ThreatLens email address',
      );
      expect(welcomeEmail({ displayName: 'D', appUrl: 'x' }).subject).toBe(
        'Welcome to ThreatLens — Your Investigation Journey Starts Here',
      );
      expect(passwordResetEmail(URL).subject).toBe(
        'Reset your ThreatLens password',
      );
    });
  });

  /**
   * These went out as HTML only, which is one of the things a spam filter holds against a
   * sender — registration and password-reset mail was landing in spam — and is also what a
   * reader whose client or screen reader prefers text is left with.
   */
  describe('the text/plain alternative', () => {
    const every: Array<[string, RenderedEmail, string]> = [
      ['verification', verificationEmail(URL), URL],
      ['welcome', welcomeEmail({ displayName: 'Dana', appUrl: URL }), URL],
      ['password reset', passwordResetEmail(URL), URL],
      [
        'organization invite',
        organizationInviteEmail({
          orgName: 'ClickBox',
          inviterName: 'Ada Admin',
          role: 'student',
          inviteUrl: URL,
        }),
        URL,
      ],
      [
        'member joined',
        organizationMemberJoinedEmail({
          adminName: 'Ada Admin',
          memberName: 'Dana',
          memberEmail: 'dana@example.com',
          orgName: 'ClickBox',
          role: 'student',
          joinedAt: new Date('2026-10-09T10:00:00Z'),
          membersUrl: URL,
        }),
        URL,
      ],
      [
        'announcement',
        organizationAnnouncementEmail({
          recipientName: 'Dana',
          orgName: 'ClickBox',
          authorName: 'Ada Admin',
          title: 'Maintenance window',
          body: 'We are upgrading on Friday.',
          announcementsUrl: URL,
        }),
        URL,
      ],
      [
        'cohort invite',
        cohortInviteEmail({
          cohortName: 'Autumn intake',
          inviterName: 'Ada Admin',
          groupName: 'Blue team',
          joinUrl: URL,
          hasAccount: false,
        }),
        URL,
      ],
    ];

    it.each(every)('%s email has one', (_name, email) => {
      expect(email.text.trim().length).toBeGreaterThan(40);
    });

    // The whole point of most of these messages. A link that exists only as an href is gone
    // the moment the markup is.
    it.each(every)(
      '%s email carries its link as a bare URL',
      (_name, email, url) => {
        expect(email.text).toContain(url);
      },
    );

    it.each(every)(
      '%s email has no markup or entities left in it',
      (_name, email) => {
        expect(email.text).not.toMatch(/<[a-z/][^>]*>/i);
        expect(email.text).not.toMatch(/&(amp|lt|gt|quot|nbsp|#39);/);
      },
    );

    it('turns the welcome email list into readable lines, not a run-on', () => {
      const { text } = welcomeEmail({ displayName: 'Dana', appUrl: URL });
      // Four getting-started steps, each on its own line rather than concatenated.
      expect(text).toMatch(/- Choose an investigation\./);
      expect(text).toMatch(/- Submit your verdict\./);
      expect(text).toContain('A ClickBox product');
    });

    it('renders an apostrophe as the character, as the HTML does', () => {
      // escapeHtml runs on the way into the heading, so the text half has to decode it again
      // or a reader called O'Brien is greeted as O&#39;Brien.
      const { text } = welcomeEmail({
        displayName: "Morgan O'Brien",
        appUrl: URL,
      });
      expect(text).toContain('Morgan');
      expect(text).not.toContain('&#39;');
    });

    it('does not repeat the same URL twice over', () => {
      // html deliberately carries it in both the button and a copyable fallback; text has no
      // button to mangle, so once is right.
      const { text } = verificationEmail(URL);
      expect(text.split(URL).length - 1).toBe(1);
    });
  });

  it('escapeHtml covers the five characters that matter in markup', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
