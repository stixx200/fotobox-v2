export const DEFAULT_API_PORT = Number(process.env.PORT) || 3000;

/** True when the renderer talks to an API on another machine. */
export function usesExternalApi(): boolean {
  return !!process.env.FOTOBOX_API_URL;
}

/**
 * Resolve the API URL the renderer should talk to. By default the Electron
 * host runs the API in-process on localhost. Set FOTOBOX_API_URL to point the
 * kiosk window at an external API instead (e.g. a shared server).
 */
export function resolveApiUrl(): string {
  if (process.env.FOTOBOX_API_URL) {
    return process.env.FOTOBOX_API_URL.replace(/\/+$/, '');
  }
  return `http://localhost:${DEFAULT_API_PORT}`;
}

/**
 * LAN API token the renderer must send to an external API (tablet mode). The
 * embedded API is reached via localhost and needs no token.
 */
export function resolveRendererApiToken(): string | null {
  if (!usesExternalApi()) {
    return null;
  }
  return process.env.FOTOBOX_LAN_API_TOKEN?.trim() || null;
}
