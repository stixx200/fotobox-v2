import { describe, expect, it, vi } from 'vitest';
import {
  isGuestShareRequest,
  isLanApiRestrictionEnabled,
  lanAccessMiddleware,
} from './lan-access.middleware';

describe('lanAccessMiddleware', () => {
  it('allows all traffic when LAN API is explicitly enabled', () => {
    process.env['FOTOBOX_ALLOW_LAN_API'] = '1';
    expect(isLanApiRestrictionEnabled()).toBe(false);
    delete process.env['FOTOBOX_ALLOW_LAN_API'];
  });

  it('blocks non-share LAN requests', () => {
    process.env['FOTOBOX_ALLOW_LAN_API'] = '0';
    const next = vi.fn();
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    lanAccessMiddleware(
      {
        method: 'GET',
        path: '/graphql',
        socket: { remoteAddress: '192.168.1.10' },
      } as never,
      res as never,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    delete process.env['FOTOBOX_ALLOW_LAN_API'];
  });

  it('allows guest share downloads from LAN clients', () => {
    expect(
      isGuestShareRequest({
        method: 'GET',
        path: '/api/share/abc123',
      } as never),
    ).toBe(true);
  });
});
