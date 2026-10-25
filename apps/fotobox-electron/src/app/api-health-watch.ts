export interface ApiHealthWatchOptions {
  /** Resolves true when the API answered correctly. May throw. */
  check: () => Promise<boolean>;
  /** Restart the API in place. Resolves false when the restart failed. */
  restart: () => Promise<boolean>;
  /** Last resort: relaunch the whole app. */
  relaunch: (reason: string) => void;
  /** Consecutive failed checks before relaunching. */
  maxFailures: number;
  onError?: (message: string, error?: unknown) => void;
}

export interface ApiHealthWatch {
  /** Run one health check. Overlapping calls are ignored. */
  tick(): Promise<void>;
  readonly failures: number;
}

/**
 * Supervises the embedded API: restart on failure, relaunch the app once
 * `maxFailures` consecutive checks failed. The failure count only resets after
 * a healthy check, so an API that keeps dying right after a "successful"
 * restart still escalates to a relaunch.
 */
export function createApiHealthWatch(
  options: ApiHealthWatchOptions,
): ApiHealthWatch {
  let failures = 0;
  let inFlight = false;

  async function tick(): Promise<void> {
    // A restart (with retries) can outlast the check interval.
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      let healthy = false;
      try {
        healthy = await options.check();
      } catch (error) {
        options.onError?.('Embedded API health check threw', error);
      }

      if (healthy) {
        failures = 0;
        return;
      }

      failures++;
      options.onError?.(
        `Embedded API health check failed (${failures}/${options.maxFailures})`,
      );

      if (failures >= options.maxFailures) {
        options.relaunch('embedded API unreachable after repeated failures');
        return;
      }

      const restarted = await options.restart();
      if (!restarted) {
        options.onError?.('Embedded API restart failed');
      }
    } finally {
      inFlight = false;
    }
  }

  return {
    tick,
    get failures() {
      return failures;
    },
  };
}
