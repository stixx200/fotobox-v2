/**
 * Runtime resolution of the Fotobox API base URL.
 *
 * The UI can run in different contexts:
 *  - Inside Electron on the host machine (API on localhost).
 *  - In a tablet/desktop browser pointing at a remote host running the API.
 *
 * Resolution order (first match wins):
 *  1. `window.__FOTOBOX_API_URL__` — injected at runtime (e.g. by the Electron
 *     preload script or a deployment-specific `config.js`).
 *  2. `localStorage['fotobox.apiUrl']` — set by the user via the settings UI so
 *     a tablet can be pointed at the host PC's IP without rebuilding.
 *  3. Same-host default: `<protocol>//<hostname>:3000`.
 */
const STORAGE_KEY = 'fotobox.apiUrl';
const DEFAULT_PORT = 3000;

declare global {
  interface Window {
    __FOTOBOX_API_URL__?: string;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const injected = window.__FOTOBOX_API_URL__;
    if (injected) {
      return normalizeBaseUrl(injected);
    }

    try {
      const stored = window.localStorage?.getItem(STORAGE_KEY);
      if (stored) {
        return normalizeBaseUrl(stored);
      }
    } catch {
      // localStorage may be unavailable (e.g. privacy mode) — ignore.
    }

    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${DEFAULT_PORT}`;
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

/** Persist a user-provided API base URL (used by the settings UI on tablets). */
export function setApiBaseUrl(url: string): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, normalizeBaseUrl(url));
  } catch {
    // Ignore storage failures.
  }
}

/** Read the currently persisted override, if any. */
export function getStoredApiBaseUrl(): string | null {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function getGraphqlHttpUri(): string {
  return `${resolveApiBaseUrl()}/graphql`;
}

export function getGraphqlWsUri(): string {
  const base = resolveApiBaseUrl();
  // Swaps the leading "http" with "ws"; the trailing "s" of "https" is
  // preserved, so https://host -> wss://host and http://host -> ws://host.
  const wsBase = base.replace(/^http/i, 'ws');
  return `${wsBase}/graphql`;
}

/**
 * Resolve a server-relative photo path (e.g. `/api/photos/photo-1.jpg`) to an
 * absolute URL against the API origin, so it loads correctly when the UI runs
 * on a different origin than the API (e.g. a tablet browser).
 */
export function getPhotoUrl(photoPath: string): string {
  if (/^(https?:|data:)/i.test(photoPath)) {
    return photoPath;
  }
  const base = resolveApiBaseUrl();
  return `${base}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
}
