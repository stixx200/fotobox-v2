import { Injectable } from '@angular/core';
import { exitKioskToWindows, isDesktopHost } from '@fotobox/frontend-core';

/** Injectable wrapper around the desktop host bridge (replaceable in tests). */
@Injectable({ providedIn: 'root' })
export class KioskHostService {
  isDesktopHost(): boolean {
    return isDesktopHost();
  }

  /** Resolves `false` when not running in the desktop app. */
  exitToWindows(): Promise<boolean> {
    return exitKioskToWindows();
  }
}
