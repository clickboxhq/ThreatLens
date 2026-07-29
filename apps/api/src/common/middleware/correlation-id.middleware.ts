import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

// Every request gets a correlation ID, propagated to logs and error responses (§5.2).
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('X-Correlation-Id');
    const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
    (req as Request & { correlationId: string }).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  }
}
