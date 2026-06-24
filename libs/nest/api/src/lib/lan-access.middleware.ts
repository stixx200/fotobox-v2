import { Request, Response, NextFunction } from 'express';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('LanAccessMiddleware');

const SHARE_PATH_PREFIX = '/api/share/';

/**
 * When the API listens on all interfaces (0.0.0.0), restrict LAN clients to
 * token-based share downloads only. Localhost keeps full access (kiosk UI).
 *
 * Set FOTOBOX_ALLOW_LAN_API=1 to also expose GraphQL, photos, settings, etc.
 * on the LAN (needed for tablet/browser clients pointed at the host IP).
 */
export function isLanApiRestrictionEnabled(): boolean {
  const allowLan = process.env['FOTOBOX_ALLOW_LAN_API'];
  return allowLan !== '1' && allowLan !== 'true';
}

function normalizeClientIp(raw: string | undefined): string {
  if (!raw) {
    return '';
  }
  if (raw.startsWith('::ffff:')) {
    return raw.slice(7);
  }
  return raw;
}

function isLoopbackClient(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1';
}

export function isGuestShareRequest(req: Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  const path = req.path.split('?')[0];
  return path.startsWith(SHARE_PATH_PREFIX) && path.length > SHARE_PATH_PREFIX.length;
}

export function lanAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isLanApiRestrictionEnabled()) {
    next();
    return;
  }

  const clientIp = normalizeClientIp(req.socket.remoteAddress);
  if (!clientIp || isLoopbackClient(clientIp)) {
    next();
    return;
  }

  if (isGuestShareRequest(req)) {
    next();
    return;
  }

  logger.warn(`Blocked LAN request from ${clientIp}: ${req.method} ${req.path}`);
  res.status(403).json({
    statusCode: 403,
    message: 'Forbidden',
  });
}
