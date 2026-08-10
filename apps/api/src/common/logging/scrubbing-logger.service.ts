import { ConsoleLogger } from '@nestjs/common';
import type { LogLevel } from '@nestjs/common';

// §5.2/§15.6: "secrets are never logged" — a log-scrubbing middleware redacts known
// secret-shaped fields from any structured log line before it is written, as a
// defense-in-depth backstop against a developer accidentally logging a full request/DTO
// object that happens to carry a password, token, or secret field. This is not a guard
// against a determined attacker (an object's values could still leak under a differently
// named key) — it's specifically the "oops, I logged the whole body" case the doc names.
const SECRET_KEY_PATTERN = /password|token|secret|authorization/i;
const REDACTED = '[REDACTED]';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// `seen` guards against circular references re-entering scrub() forever; passing the same
// already-scrubbed object back out (rather than throwing) is safe since scrub() never
// mutates its input. Exported as a pure function so its redaction behavior is directly
// unit-testable without going through Nest's logger plumbing (same rationale as
// computeLockoutSeconds/scorer.ts's pure-function extraction elsewhere in this codebase).
export function scrub(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, seen));
  }
  if (!isPlainObject(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : scrub(val, seen);
  }
  return result;
}

export class ScrubbingLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ): void {
    super.printMessages(
      messages.map((m) => scrub(m)),
      context,
      logLevel,
      writeStreamType,
    );
  }
}
