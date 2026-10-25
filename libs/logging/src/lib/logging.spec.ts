import { describe, expect, it } from 'vitest';
import { close, getLogger } from './logging';

describe('logging', () => {
  it('returns a winston logger with standard methods', () => {
    const log = getLogger('test');
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('shares transports instead of adding listeners per logger', () => {
    const loggers = Array.from({ length: 20 }, (_, i) => getLogger(`ctx-${i}`));
    expect(loggers[0].transports).toBe(loggers[19].transports);
  });

  it('exposes close without throwing', () => {
    expect(() => close()).not.toThrow();
  });
});
