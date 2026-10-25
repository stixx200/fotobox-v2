import { describe, expect, it, vi } from 'vitest';
import { createApiHealthWatch } from './api-health-watch';

function setup(checks: Array<boolean | Error>) {
  const check = vi.fn(async () => {
    const next = checks.shift() ?? true;
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
  const restart = vi.fn(async () => true);
  const relaunch = vi.fn();
  const watch = createApiHealthWatch({
    check,
    restart,
    relaunch,
    maxFailures: 3,
  });
  return { watch, check, restart, relaunch };
}

describe('createApiHealthWatch', () => {
  it('does nothing while healthy', async () => {
    const { watch, restart, relaunch } = setup([true, true]);
    await watch.tick();
    await watch.tick();
    expect(restart).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();
  });

  it('restarts on failure and resets after a healthy check', async () => {
    const { watch, restart } = setup([false, true]);
    await watch.tick();
    expect(restart).toHaveBeenCalledTimes(1);
    expect(watch.failures).toBe(1);
    await watch.tick();
    expect(watch.failures).toBe(0);
  });

  it('relaunches when restarts do not bring the API back', async () => {
    const { watch, restart, relaunch } = setup([
      false,
      new Error('ECONNREFUSED'),
      false,
    ]);
    await watch.tick();
    await watch.tick();
    await watch.tick();
    expect(restart).toHaveBeenCalledTimes(2);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it('ignores ticks while a check or restart is in flight', async () => {
    let release: (healthy: boolean) => void = () => undefined;
    const check = vi.fn(
      () => new Promise<boolean>((resolve) => (release = resolve)),
    );
    const watch = createApiHealthWatch({
      check,
      restart: vi.fn(async () => true),
      relaunch: vi.fn(),
      maxFailures: 3,
    });
    const first = watch.tick();
    await watch.tick();
    expect(check).toHaveBeenCalledTimes(1);
    release(true);
    await first;
  });
});
