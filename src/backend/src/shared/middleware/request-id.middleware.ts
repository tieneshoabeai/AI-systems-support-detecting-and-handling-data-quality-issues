import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = (req.headers['x-request-id'] as string) || '';
    const id = incoming.trim() || randomUUID();
    (req as unknown as Record<string, unknown>).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
