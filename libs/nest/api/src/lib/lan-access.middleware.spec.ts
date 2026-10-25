import { describe, expect, it, vi } from 'vitest';
import {
  isFullAccessAllowed,
  isLanApiEnabled,
  isTrustedOrigin,
  resolveAccessPolicy,
  type AccessPolicy,
} from './access-policy';
import {
  createLanAccessMiddleware,
  isGuestShareRequest,
} from './lan-access.middleware';

const restricted: AccessPolicy = resolveAccessPolicy({});
const tablet: AccessPolicy = resolveAccessPolicy({
  FOTOBOX_ALLOW_LAN_API: '1',
  FOTOBOX_LAN_API_TOKEN: 'secret-token',
});

function runMiddleware(
  policy: AccessPolicy,
  req: {
    method?: string;
    path?: string;
    remoteAddress?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  },
) {
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  createLanAccessMiddleware(policy)(
    {
      method: req.method ?? 'POST',
      path: req.path ?? '/graphql',
      socket: { remoteAddress: req.remoteAddress ?? '192.168.1.10' },
      headers: req.headers ?? {},
      query: req.query ?? {},
    } as never,
    res as never,
    next,
  );
  return { next, res };
}

describe('access policy', () => {
  it('keeps tablet mode locked when no token is configured', () => {
    const policy = resolveAccessPolicy({ FOTOBOX_ALLOW_LAN_API: '1' });
    expect(policy.lanApiRequested).toBe(true);
    expect(isLanApiEnabled(policy)).toBe(false);
    expect(
      isFullAccessAllowed(
        { remoteAddress: '192.168.1.10', origin: undefined, token: undefined },
        policy,
      ),
    ).toBe(false);
  });

  it('enables tablet mode with a token', () => {
    expect(isLanApiEnabled(tablet)).toBe(true);
  });

  it('trusts Electron and localhost origins only', () => {
    expect(isTrustedOrigin(undefined, restricted)).toBe(true);
    expect(isTrustedOrigin('null', restricted)).toBe(true);
    expect(isTrustedOrigin('file://', restricted)).toBe(true);
    expect(isTrustedOrigin('http://localhost:4200', restricted)).toBe(true);
    expect(isTrustedOrigin('http://127.0.0.1:3000', restricted)).toBe(true);
    expect(isTrustedOrigin('https://evil.example', restricted)).toBe(false);
    expect(isTrustedOrigin('http://localhost.evil.example', restricted)).toBe(
      false,
    );
  });

  it('honours FOTOBOX_TRUSTED_ORIGINS', () => {
    const policy = resolveAccessPolicy({
      FOTOBOX_TRUSTED_ORIGINS: 'http://kiosk.local:8080/',
    });
    expect(isTrustedOrigin('http://kiosk.local:8080', policy)).toBe(true);
  });

  it('rejects loopback clients from untrusted browser origins', () => {
    expect(
      isFullAccessAllowed(
        {
          remoteAddress: '127.0.0.1',
          origin: 'https://evil.example',
          token: undefined,
        },
        restricted,
      ),
    ).toBe(false);
  });

  it('accepts LAN clients only with the correct token', () => {
    const lan = { remoteAddress: '::ffff:192.168.1.10', origin: undefined };
    expect(isFullAccessAllowed({ ...lan, token: 'secret-token' }, tablet)).toBe(
      true,
    );
    expect(isFullAccessAllowed({ ...lan, token: 'wrong' }, tablet)).toBe(false);
    expect(isFullAccessAllowed({ ...lan, token: undefined }, tablet)).toBe(
      false,
    );
    expect(
      isFullAccessAllowed({ ...lan, token: 'secret-token' }, restricted),
    ).toBe(false);
  });
});

describe('lanAccessMiddleware', () => {
  it('blocks non-share LAN requests', () => {
    const { next, res } = runMiddleware(restricted, {});
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows loopback requests', () => {
    const { next } = runMiddleware(restricted, { remoteAddress: '::1' });
    expect(next).toHaveBeenCalled();
  });

  it('allows guest share downloads from LAN clients', () => {
    expect(
      isGuestShareRequest({
        method: 'GET',
        path: '/api/share/abc123',
      } as never),
    ).toBe(true);
    const { next } = runMiddleware(restricted, {
      method: 'GET',
      path: '/api/share/abc123',
    });
    expect(next).toHaveBeenCalled();
  });

  it('accepts the token from header or query string in tablet mode', () => {
    expect(
      runMiddleware(tablet, { headers: { 'x-fotobox-token': 'secret-token' } })
        .next,
    ).toHaveBeenCalled();
    expect(
      runMiddleware(tablet, {
        method: 'GET',
        path: '/api/photos/photo-1.jpg',
        query: { token: 'secret-token' },
      }).next,
    ).toHaveBeenCalled();
  });
});
