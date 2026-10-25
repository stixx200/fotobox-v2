import { Request, Response, NextFunction } from 'express';
import { getLogger } from '@fotobox/logging';
import {
  API_TOKEN_HEADER,
  API_TOKEN_QUERY_PARAM,
  isFullAccessAllowed,
  isGuestSharePath,
  normalizeClientIp,
  readOriginHeader,
  resolveAccessPolicy,
  type AccessPolicy,
} from './access-policy';

const logger = getLogger('LanAccessMiddleware');

export function isGuestShareRequest(req: Request): boolean {
  return isGuestSharePath(req.method, req.path);
}

function readRequestToken(req: Request): unknown {
  const header = req.headers[API_TOKEN_HEADER];
  if (typeof header === 'string' && header) {
    return header;
  }
  return req.query?.[API_TOKEN_QUERY_PARAM];
}

/**
 * Enforces the {@link AccessPolicy} for HTTP requests. WebSocket upgrades do
 * not pass through Express — they are checked in the graphql-ws `onConnect`
 * hook (see `api.module.ts`).
 */
export function createLanAccessMiddleware(
  policy: AccessPolicy = resolveAccessPolicy(),
) {
  return function lanAccessMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // Guest share links are public by design (token in the path).
    if (isGuestShareRequest(req)) {
      next();
      return;
    }

    // CORS preflights carry no credentials; the CORS layer answers them.
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const allowed = isFullAccessAllowed(
      {
        remoteAddress: req.socket.remoteAddress,
        origin: readOriginHeader(req.headers),
        token: readRequestToken(req),
      },
      policy,
    );
    if (allowed) {
      next();
      return;
    }

    const clientIp = normalizeClientIp(req.socket.remoteAddress);
    logger.warn(
      `Blocked request from ${clientIp || 'unknown'}: ${req.method} ${req.path}`,
    );
    res.status(403).json({
      statusCode: 403,
      message: 'Forbidden',
    });
  };
}
