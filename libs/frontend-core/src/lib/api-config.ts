/**
 * Runtime resolution of the Fotobox API base URL.
 *
 * Resolution order (first match wins):
 *  1. `window.__FOTOBOX_API_URL__` — injected at runtime (Electron preload, etc.)
 *  2. `localStorage['fotobox.apiUrl']` — user override from settings UI
 *  3. Same-host default: `<protocol>//<hostname>:3000`
 */
const API_STORAGE_KEY = 'fotobox.apiUrl';
const COLLAGE_DIRECTORY_KEY = 'collage-editor.directory';
const LANGUAGE_STORAGE_KEY = 'fotobox.language';
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
  return `${base}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
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
