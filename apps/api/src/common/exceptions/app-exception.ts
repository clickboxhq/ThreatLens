import { HttpException } from '@nestjs/common';

// Domain-meaningful exceptions carry a machine-readable `code` alongside the
// HTTP status, per docs/ThreatLens-Architecture.md §16.1 / §18.6.
export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    // §15.5: rate-limit/lockout responses carry a `Retry-After` header — applied by
    // AllExceptionsFilter, since that's the one place every thrown error passes through.
    public readonly headers?: Record<string, string>,
  ) {
    super(message, status);
  }
}
