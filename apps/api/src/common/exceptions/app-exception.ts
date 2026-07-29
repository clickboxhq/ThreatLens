import { HttpException } from '@nestjs/common';

// Domain-meaningful exceptions carry a machine-readable `code` alongside the
// HTTP status, per docs/SOCVerse-Architecture.md §16.1 / §18.6.
export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message, status);
  }
}
