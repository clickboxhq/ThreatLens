import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * Every controller is behind the paywall unless it is listed here, on purpose.
 *
 * ThreatLens has no free tier, so an ungated controller is a hole in the paywall — and the
 * way that happens is not a decision, it is somebody adding a controller next month and not
 * knowing this guard exists. A unit test of the guard itself cannot catch that; only
 * something that looks at every controller can.
 *
 * The list is the exemptions rather than the inclusions, so the default for anything new is
 * gated. Failing closed on a new controller costs one test run; failing open costs revenue
 * quietly and indefinitely.
 */
const EXEMPT: Record<string, string> = {
  'modules/auth/auth.controller.ts':
    'signing in is how somebody reaches anything, including the billing page',
  'modules/billing/billing.controller.ts':
    'the page that takes money — gating it traps anyone whose trial lapsed',
  'modules/profile/profile.controller.ts': 'your own account and sign-out',
  'modules/notifications/notifications.controller.ts':
    'carries "your trial is ending", which is most needed once it has',
  'modules/learning/certificate-verification.controller.ts':
    'public certificate check, reached without an account at all',
  'modules/instructor/cohort-invite-public.controller.ts':
    'public invite preview, before any account exists',
  'modules/organizations/invite-preview.controller.ts':
    'public invite preview, before any account exists',
};

const STAFF_PREFIXES = ['modules/admin/', 'common/'];

function controllerFiles(root: string): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.controller.ts')) out.push(full);
    }
  })(root);
  return out;
}

describe('paywall coverage', () => {
  const root = join(__dirname, '..', '..');
  const files = controllerFiles(root);

  it('finds the controllers at all', () => {
    // A path change that silently matched nothing would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(
    files
      .map((f) => relative(root, f).split(sep).join('/'))
      .filter(
        (rel) =>
          !STAFF_PREFIXES.some((p) => rel.startsWith(p)) && !(rel in EXEMPT),
      )
      .map((rel) => [rel] as const),
  )('%s requires a subscription', (rel) => {
    const src = readFileSync(join(root, rel), 'utf8');
    expect(src).toContain('SubscriptionGuard');
  });

  it('applies the guard after JwtAuthGuard everywhere it is used', () => {
    // The guard reads the caller JwtAuthGuard attaches. Listed first, it sees nobody and
    // waves the request through — a paywall that is present and does nothing.
    const wrong: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const uses = src.match(/@UseGuards\(([^)]*)\)/g) ?? [];
      for (const use of uses) {
        if (!use.includes('SubscriptionGuard')) continue;
        const names = use
          .replace(/@UseGuards\(|\)/g, '')
          .split(',')
          .map((s) => s.trim());
        if (
          names.indexOf('SubscriptionGuard') < names.indexOf('JwtAuthGuard')
        ) {
          wrong.push(relative(root, file).split(sep).join('/'));
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('keeps every exemption documented with a reason', () => {
    // An exemption without a stated reason is how a hole in the paywall gets normalised.
    for (const reason of Object.values(EXEMPT)) {
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});
