/**
 * Runtime resolution of the Fotobox API base URL.
 *
 * Resolution order (first match wins):
 *  1. `window.__FOTOBOX_API_URL__` — injected at runtime (Tauri init script, etc.)
 *  2. `localStorage['fotobox.apiUrl']` — user override from settings UI
 *  3. Same-host default: `<protocol>//<hostname>:5100`
 */
const API_STORAGE_KEY = 'fotobox.apiUrl';
const API_TOKEN_STORAGE_KEY = 'fotobox.apiToken';
const API_TOKEN_QUERY_PARAM = 'token';
/** Header the API checks for the LAN token (see access-policy.ts). */
export const API_TOKEN_HEADER = 'x-fotobox-token';
const COLLAGE_DIRECTORY_KEY = 'collage-editor.directory';
const LANGUAGE_STORAGE_KEY = 'fotobox.language';
const DEFAULT_PORT = 5100;

declare global {
  interface Window {
    __FOTOBOX_API_URL__?: string;
    __FOTOBOX_API_TOKEN__?: string;
    /** Collage directory passed by the desktop host to the editor window. */
    __FOTOBOX_COLLAGE_DIR__?: string;
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
      const stored = window.localStorage?.getItem(API_STORAGE_KEY);
      if (stored) {
        return normalizeBaseUrl(stored);
      }
    } catch {
      // localStorage may be unavailable — ignore.
    }

    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${DEFAULT_PORT}`;
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

export function setApiBaseUrl(url: string): void {
  try {
    window.localStorage?.setItem(API_STORAGE_KEY, normalizeBaseUrl(url));
  } catch {
    // Ignore storage failures.
  }
}

export function getStoredApiBaseUrl(): string | null {
  try {
    return window.localStorage?.getItem(API_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * LAN API token for tablet mode. Only needed when the API runs on another
 * machine; the kiosk on the host talks to localhost without one.
 *
 * Resolution order: injected `window.__FOTOBOX_API_TOKEN__`, a `?token=` query
 * parameter (persisted so a tablet only needs the link once), localStorage.
 */
export function resolveApiToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (window.__FOTOBOX_API_TOKEN__) {
    return window.__FOTOBOX_API_TOKEN__;
  }
  try {
    const fromQuery = new URLSearchParams(window.location.search).get(
      API_TOKEN_QUERY_PARAM,
    );
    if (fromQuery) {
      setApiToken(fromQuery);
      return fromQuery;
    }
    return window.localStorage?.getItem(API_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setApiToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage?.setItem(API_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage?.removeItem(API_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

export function getApiAuthHeaders(): Record<string, string> {
  const token = resolveApiToken();
  return token ? { [API_TOKEN_HEADER]: token } : {};
}

export function getGraphqlHttpUri(): string {
  return `${resolveApiBaseUrl()}/graphql`;
}

export function getGraphqlWsUri(): string {
  const base = resolveApiBaseUrl();
  const wsBase = base.replace(/^http/i, 'ws');
  return `${wsBase}/graphql`;
}

export function getPhotoUrl(photoPath: string): string {
  if (/^(https?:|data:)/i.test(photoPath)) {
    return photoPath;
  }
  const base = resolveApiBaseUrl();
  const url = `${base}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
  // <img src> cannot send headers, so the token travels as a query parameter.
  const token = resolveApiToken();
  if (!token) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${API_TOKEN_QUERY_PARAM}=${encodeURIComponent(token)}`;
}

/** Collage directory the desktop host opened the editor with, if any. */
export function getHostCollageDirectory(): string | null {
  return (
    (typeof window !== 'undefined' && window.__FOTOBOX_COLLAGE_DIR__) || null
  );
}

export function getStoredCollageDirectory(): string | null {
  try {
    return window.localStorage?.getItem(COLLAGE_DIRECTORY_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setStoredCollageDirectory(path: string): void {
  try {
    window.localStorage?.setItem(COLLAGE_DIRECTORY_KEY, path);
  } catch {
    // ignore
  }
}

export function readStoredLanguage(fallback = 'de'): string {
  try {
    return window.localStorage?.getItem(LANGUAGE_STORAGE_KEY) || fallback;
  } catch {
    return fallback;
  }
}
