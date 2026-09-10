import {
  verificationEmail,
  welcomeEmail,
  passwordResetEmail,
  escapeHtml,
} from './email-templates';

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

  describe('structure every client depends on', () => {
    it.each([
      ['verification', verificationEmail(URL).html],
      ['welcome', welcomeEmail({ displayName: 'Dana', appUrl: URL }).html],
      ['password reset', passwordResetEmail(URL).html],
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

  it('escapeHtml covers the five characters that matter in markup', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
