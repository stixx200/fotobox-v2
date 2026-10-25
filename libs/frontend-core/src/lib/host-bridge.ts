import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Native features of the desktop host (Tauri). Everything else — camera,
 * printing, settings — goes through the GraphQL API, so the UI also works in a
 * plain browser (tablet mode), where these calls are no-ops.
 */
export function isDesktopHost(): boolean {
  return typeof window !== 'undefined' && isTauri();
}

/** Native folder picker. Resolves `null` when cancelled or not on desktop. */
export async function pickDirectory(title?: string): Promise<string | null> {
  if (!isDesktopHost()) {
    return null;
  }
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false, title });
  return typeof selected === 'string' ? selected : null;
}

/**
 * Open the collage editor in its own desktop window. Resolves `false` when not
 * running on the desktop host so callers can fall back to a browser tab.
 */
export async function openCollageEditorWindow(
  collageDirectory?: string,
): Promise<boolean> {
  if (!isDesktopHost()) {
    return false;
  }
  await invoke('open_collage_editor', {
    collageDirectory: collageDirectory ?? null,
  });
  return true;
}

/**
 * Leave the kiosk so the operator can switch to the Windows administrator
 * account for maintenance; the host restarts the Fotobox automatically later.
 * Resolves `false` when not running on the desktop host.
 */
export async function exitKioskToWindows(): Promise<boolean> {
  if (!isDesktopHost()) {
    return false;
  }
  await invoke('exit_kiosk');
  return true;
}
