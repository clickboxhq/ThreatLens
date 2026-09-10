/**
 * HTML for the transactional emails.
 *
 * Email is not the web. Gmail strips <head> styles on some clients, Outlook renders through
 * Word (no flexbox, no grid, unreliable padding on anything but table cells), and images are
 * blocked by default in most clients until the reader opts in. So: table layout, inline styles
 * on every element that matters, no external assets, and a wordmark drawn in text rather than
 * an <img> that would show as a broken box.
 *
 * The <style> block carries only progressive enhancement — dark-mode colours for the clients
 * that honour prefers-color-scheme (Apple Mail, iOS). Everything still reads correctly when
 * it is dropped entirely.
 */

const BRAND = '#3E82F7';
const INK = '#0A0A0A';
const BODY_TEXT = '#2A2A2E';
const MUTED = '#6B6F76';
const PAGE_BG = '#F3F5F7';
const SURFACE = '#FFFFFF';
const HAIRLINE = '#E3E6EA';

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/**
 * Escapes text interpolated into email HTML.
 *
 * Display names are user-supplied and reach the welcome email, so they are attacker-controlled
 * markup unless escaped. Mail clients do render HTML, and the reader cannot inspect source
 * before it renders.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailLayoutInput {
  /** Shown in the inbox preview line, after the subject. */
  preheader: string;
  /** Plain text — escaped on the way in, so pass a raw name rather than pre-escaping it. */
  heading: string;
  /** Raw HTML, so inline markup works. Escape anything user-supplied before it goes in here. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small print under the button — expiry, single-use, and so on. */
  meta?: string;
  /** The raw URL, repeated for readers whose client mangles the button. */
  fallbackUrl?: string;
  /** Optional closing note above the signature. */
  footnote?: string;
  /** Sign-off line(s). Raw HTML (a `<br>` is fine). Defaults to the team line. */
  signoff?: string;
}

function button(label: string, url: string): string {
  // Table-based rather than a padded <a>: Outlook ignores padding on inline elements, which
  // would collapse this into bare blue text. The mso conditional gives Outlook its own
  // rectangle so the button keeps its shape there too.
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
    <tr>
      <td align="center" bgcolor="${BRAND}" style="border-radius:6px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="14%" stroke="f" fillcolor="${BRAND}">
        <w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${url}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;background-color:${BRAND};">${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;
}

export function renderEmail(input: EmailLayoutInput): string {
  const {
    preheader,
    heading,
    paragraphs,
    cta,
    meta,
    fallbackUrl,
    footnote,
    signoff,
  } = input;

  const body = paragraphs
    .map(
      (p) =>
        // tl-text, or the dark-mode override never reaches these and the body renders as
        // near-black on near-black. An inline colour with no class is invisible to the
        // media query that is supposed to replace it.
        `<p class="tl-text" style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY_TEXT};">${p}</p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(heading)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .tl-page { background:#050505 !important; }
    .tl-card { background:#0F0F11 !important; border-color:#26262B !important; }
    .tl-text { color:#DDE1E6 !important; }
    h1.tl-text { color:#F2F4F7 !important; }
    .tl-muted { color:#9AA0A8 !important; }
    .tl-rule { border-color:#26262B !important; }
    .tl-fallback { background:#161619 !important; color:#9AA0A8 !important; }
  }
  @media (max-width:620px) {
    .tl-card { width:100% !important; }
    .tl-pad { padding-left:24px !important; padding-right:24px !important; }
  }
</style>
</head>
<body class="tl-page" style="margin:0;padding:0;background-color:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader)}</div>
<!-- preheader padding: stops the client pulling body copy into the preview line -->
<div style="display:none;max-height:0;overflow:hidden;">&#8199;&#65279;&#847;&nbsp;&#8199;&#65279;&#847;&nbsp;&#8199;&#65279;&#847;&nbsp;&#8199;&#65279;&#847;&nbsp;&#8199;&#65279;&#847;&nbsp;&#8199;&#65279;&#847;&nbsp;&#8199;&#65279;&#847;&nbsp;</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="tl-page" style="background-color:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="tl-card" style="width:600px;max-width:600px;background-color:${SURFACE};border:1px solid ${HAIRLINE};border-radius:10px;overflow:hidden;">

        <tr>
          <td style="background-color:${INK};padding:20px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${MONO};font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:-0.2px;">
                  <span style="color:${BRAND};">&#9670;</span>&nbsp;ThreatLens
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="tl-pad" style="padding:36px 36px 8px;">
            <h1 class="tl-text" style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:600;color:${INK};">${escapeHtml(heading)}</h1>
            ${body}
            ${cta ? button(cta.label, cta.url) : ''}
            ${
              meta
                ? `<p class="tl-muted" style="margin:8px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">${meta}</p>`
                : ''
            }
          </td>
        </tr>

        ${
          footnote
            ? `<tr><td class="tl-pad" style="padding:20px 36px 0;">
                 <p class="tl-muted" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${footnote}</p>
               </td></tr>`
            : ''
        }

        ${
          fallbackUrl
            ? `<tr><td class="tl-pad" style="padding:24px 36px 0;">
                 <p class="tl-muted" style="margin:0 0 6px;font-family:${FONT};font-size:12px;color:${MUTED};">Button not working? Paste this into your browser:</p>
                 <p class="tl-fallback" style="margin:0;padding:10px 12px;background-color:${PAGE_BG};border-radius:6px;font-family:${MONO};font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">${fallbackUrl}</p>
               </td></tr>`
            : ''
        }

        <tr>
          <td class="tl-pad" style="padding:28px 36px 32px;">
            <div class="tl-rule" style="border-top:1px solid ${HAIRLINE};padding-top:18px;">
              <p class="tl-muted" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
                ${signoff ?? '— The ThreatLens team'}
              </p>
            </div>
          </td>
        </tr>

      </table>

      <p class="tl-muted" style="margin:16px 0 0;font-family:${FONT};font-size:11.5px;color:${MUTED};">
        ThreatLens — hands-on security investigation training
      </p>

    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------- the emails

export function verificationEmail(verifyUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: 'Verify your ThreatLens email address',
    html: renderEmail({
      preheader:
        'Confirm your address to start scored investigations — the link is good for 24 hours.',
      heading: 'Confirm your email address',
      paragraphs: [
        'Confirm your address to unlock scored investigations, so your work counts towards your skill profile and any certificates you earn.',
      ],
      cta: { label: 'Verify my email address', url: verifyUrl },
      meta: 'This link expires in 24 hours.',
      fallbackUrl: verifyUrl,
      footnote:
        'If you did not create a ThreatLens account, you can ignore this email and nothing will happen.',
    }),
  };
}

export function welcomeEmail(input: { displayName: string; appUrl: string }): {
  subject: string;
  html: string;
} {
  // Not escaped here: renderEmail escapes the heading, and escaping twice would show a
  // reader called O'Brien their own name as "O&#39;Brien".
  const name = input.displayName.trim().split(/\s+/)[0] || 'there';

  // An <ol> is one of the few block elements Outlook/Word renders predictably, so the
  // getting-started steps go in as a real list rather than four numbered paragraphs.
  const steps = `
    <ol style="margin:4px 0 4px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY_TEXT};">
      <li style="margin:0 0 10px;"><strong>Choose an investigation.</strong> Browse the scenarios and pick one that matches your experience. New to this? Start with a scenario tagged <em>Beginner</em>.</li>
      <li style="margin:0 0 10px;"><strong>Analyze the scenario.</strong> Read the incident carefully, examine what you're given, and get a picture of what happened.</li>
      <li style="margin:0 0 10px;"><strong>Investigate and decide.</strong> Work the evidence with the investigation tools, follow the leads, and document what you find.</li>
      <li style="margin:0;"><strong>Submit your verdict.</strong> When you're confident, submit. Your analysis and decisions are graded, and you get a scored breakdown of how you did.</li>
    </ol>`;

  return {
    subject: 'Welcome to ThreatLens — Your Investigation Journey Starts Here',
    html: renderEmail({
      preheader:
        'Your account is ready — choose a scenario and start investigating.',
      heading: `Welcome to ThreatLens, ${name}`,
      paragraphs: [
        "We're glad to have you here. Your email is confirmed and your ThreatLens account is ready.",
        'ThreatLens builds practical cybersecurity investigation skills through realistic, interactive scenarios. Instead of reading about security incidents, you work through them — analyse the evidence, make decisions, and commit to a verdict.',
        "<strong>Here's how to get started:</strong>",
        steps,
        '<strong>Learn by investigating.</strong> ThreatLens is built to take you past theory and into the practical thinking a real incident demands. Take your time. Follow the evidence. Think critically.',
        'Your first investigation is waiting.',
      ],
      cta: { label: 'Start your first investigation', url: input.appUrl },
      meta: 'New here? Start with a scenario tagged Beginner.',
      signoff: '— The ThreatLens Team<br>A ClickBox product',
    }),
  };
}

export function passwordResetEmail(resetUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: 'Reset your ThreatLens password',
    html: renderEmail({
      preheader:
        'Choose a new password. The link works once and expires in an hour.',
      heading: 'Reset your password',
      paragraphs: [
        'We received a request to reset the password on your ThreatLens account. Choose a new one here:',
        // Named explicitly because this reset is also the recovery path for a lost
        // authenticator (see confirmPasswordReset) — someone locked out of 2FA needs to know
        // this link is what clears it, not just that it changes their password.
        'If two-factor authentication is switched on for your account, completing this reset also turns it off, so you can sign in again if you have lost your authenticator app.',
      ],
      cta: { label: 'Reset my password', url: resetUrl },
      meta: 'This link can only be used once, and expires in 1 hour.',
      fallbackUrl: resetUrl,
      footnote:
        'If you did not request this, you can safely ignore this email — nothing changes unless you open the link and set a new password.',
    }),
  };
}

const STAFF_ROLE_LABEL: Record<string, string> = {
  lead: 'a lead',
  tutor: 'a tutor',
  group_tutor: 'a group tutor',
};

export function cohortInviteEmail(input: {
  cohortName: string;
  inviterName: string;
  groupName: string | null;
  joinUrl: string;
  /** Whether an account already exists for this address, which changes what we ask them to do. */
  hasAccount: boolean;
  /** Set when the invitation is to teach rather than to take part. */
  staffRole?: string | null;
}): { subject: string; html: string } {
  const cohort = escapeHtml(input.cohortName);
  const inviter = escapeHtml(input.inviterName);
  const group = input.groupName ? escapeHtml(input.groupName) : null;

  const asStaff = Boolean(input.staffRole);
  const roleLabel = input.staffRole
    ? (STAFF_ROLE_LABEL[input.staffRole] ?? 'a tutor')
    : null;

  return {
    subject: asStaff
      ? `${input.inviterName} invited you to teach ${input.cohortName} on ThreatLens`
      : `${input.inviterName} invited you to ${input.cohortName} on ThreatLens`,
    html: renderEmail({
      preheader: asStaff
        ? `Join ${input.cohortName} as ${roleLabel}.`
        : `Join ${input.cohortName} and start working investigations.`,
      heading: `You have been invited to ${input.cohortName}`,
      paragraphs: [
        asStaff
          ? `<strong>${inviter}</strong> has invited you to teach on <strong>${cohort}</strong> as ${roleLabel}${
              group ? `, for <strong>${group}</strong>` : ''
            }.`
          : `<strong>${inviter}</strong> has invited you to join <strong>${cohort}</strong> on ThreatLens${
              group ? `, in <strong>${group}</strong>` : ''
            }.`,
        asStaff
          ? 'ThreatLens is hands-on security investigation training. As teaching staff you set assignments, follow how people are doing, and give feedback on the investigations they submit.'
          : 'ThreatLens is hands-on security investigation training: you work a realistic incident from the alert, and get scored on how you investigated it.',
        // The one instruction that changes per recipient. Telling somebody with no account to
        // "sign in" is the fastest way to lose them.
        input.hasAccount
          ? 'Sign in and the invitation will be waiting for you.'
          : asStaff
            ? 'You will be asked to create an account first. Choose the instructor account type — a student account cannot take a teaching role.'
            : 'You will be asked to create an account first — it takes a moment, and the invitation is applied as soon as you have one.',
      ],
      cta: {
        label: input.hasAccount
          ? asStaff
            ? 'Join the teaching staff'
            : 'Join the cohort'
          : 'Accept your invitation',
        url: input.joinUrl,
      },
      meta: 'This invitation expires in 7 days.',
      fallbackUrl: input.joinUrl,
      footnote:
        'If you were not expecting this, you can ignore this email — nothing happens until you accept.',
    }),
  };
}
