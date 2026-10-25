import * as crypto from 'crypto';
import type { IncomingHttpHeaders } from 'http';

/** Header carrying the LAN API token for HTTP requests. */
export const API_TOKEN_HEADER = 'x-fotobox-token';
/** Query parameter fallback for requests that cannot set headers (`<img src>`). */
export const API_TOKEN_QUERY_PARAM = 'token';

const SHARE_PATH_PREFIX = '/api/share/';

/**
 * Who may talk to the API.
 *
 * - Loopback clients (the kiosk UI) have full access, unless the request comes
 *   from an untrusted browser origin (e.g. a web page open on the host machine).
 * - LAN clients may only fetch guest share links, unless tablet mode is
 *   enabled (`FOTOBOX_ALLOW_LAN_API=1`) and they present the shared secret
 *   from `FOTOBOX_LAN_API_TOKEN`. Tablet mode without a token stays locked.
 */
export interface AccessPolicy {
  /** Tablet mode requested via `FOTOBOX_ALLOW_LAN_API`. */
  lanApiRequested: boolean;
  /** Shared secret LAN clients must present; null when not configured. */
  lanApiToken: string | null;
  /** Extra browser origins trusted for loopback clients. */
  extraTrustedOrigins: string[];
}

export function resolveAccessPolicy(
  env: NodeJS.ProcessEnv = process.env,
): AccessPolicy {
  const allowLan = env['FOTOBOX_ALLOW_LAN_API'];
  const token = env['FOTOBOX_LAN_API_TOKEN']?.trim();
  return {
    lanApiRequested: allowLan === '1' || allowLan === 'true',
    lanApiToken: token ? token : null,
    extraTrustedOrigins: (env['FOTOBOX_TRUSTED_ORIGINS'] ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  };
}

/** True when tablet mode is requested and a token is configured. */
export function isLanApiEnabled(policy: AccessPolicy): boolean {
  return policy.lanApiRequested && policy.lanApiToken !== null;
}

export function normalizeClientIp(raw: string | undefined): string {
  if (!raw) {
    return '';
  }
  if (raw.startsWith('::ffff:')) {
    return raw.slice(7);
  }
  return raw;
}

export function isLoopbackAddress(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.');
}

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Origins of the Tauri webview: `tauri://localhost` (macOS/Linux) and
 * `http(s)://tauri.localhost` (Windows/WebView2). */
const TAURI_ORIGIN = /^(tauri:\/\/localhost|https?:\/\/tauri\.localhost)$/i;

/**
 * Browser origins allowed to drive the API from the host machine: the Tauri
 * desktop webview, `file://` pages (reported as `null`) and local dev
 * servers. Requests without an Origin header are not browser cross-origin
 * requests and are allowed.
 */
export function isTrustedOrigin(
  origin: string | undefined,
  policy: AccessPolicy,
): boolean {
  if (!origin) {
    return true;
  }
  const normalized = origin.replace(/\/+$/, '');
  return (
    normalized === 'null' ||
    normalized === 'file:' ||
    LOOPBACK_ORIGIN.test(normalized) ||
    TAURI_ORIGIN.test(normalized) ||
    policy.extraTrustedOrigins.includes(normalized)
  );
}

function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function hasValidLanToken(
  policy: AccessPolicy,
  provided: unknown,
): boolean {
  return (
    isLanApiEnabled(policy) &&
    typeof provided === 'string' &&
    tokensMatch(policy.lanApiToken as string, provided)
  );
}

export interface ClientAccessRequest {
  remoteAddress: string | undefined;
  origin: string | undefined;
  token: unknown;
}

/** Full API access (GraphQL, photos, settings, …). */
export function isFullAccessAllowed(
  request: ClientAccessRequest,
  policy: AccessPolicy,
): boolean {
  if (hasValidLanToken(policy, request.token)) {
    return true;
  }
  const ip = normalizeClientIp(request.remoteAddress);
  return isLoopbackAddress(ip) && isTrustedOrigin(request.origin, policy);
}

export function isGuestSharePath(method: string, path: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  const pathname = path.split('?')[0];
  return (
    pathname.startsWith(SHARE_PATH_PREFIX) &&
    pathname.length > SHARE_PATH_PREFIX.length
  );
}

export function readOriginHeader(
  headers: IncomingHttpHeaders,
): string | undefined {
  const origin = headers['origin'];
  return Array.isArray(origin) ? origin[0] : origin;
}
