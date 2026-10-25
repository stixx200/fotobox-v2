import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { filter, firstValueFrom, take } from 'rxjs';
import { CameraStore } from '../store';
import { ClientLogService } from './client-log.service';
import { LayoutNavigationService } from './layout-navigation.service';
import { isOptionalPin } from './pin.util';
import { Setting } from './settings.service';
import { readSettingValue } from './settings-value.util';

const DEFAULT_CAMERA = 'demo';
const DEFAULT_LAYOUT = 'Einzelbild';

/** The settings a start depends on (form values or saved settings). */
export interface StartValues {
  camera?: unknown;
  layouts?: unknown;
  galleryPassword?: unknown;
  operatorPin?: unknown;
}

export interface StartConfig {
  camera: string;
  layouts: string[];
}

/**
 * The checks "Fotobox starten" applies: both PINs must be empty or exactly
 * four digits; a missing camera falls back to the demo camera and missing
 * layouts to the single picture. Returns `null` when the booth can't start.
 */
export function resolveStartConfig(values: StartValues): StartConfig | null {
  const pins = [values.galleryPassword ?? '', values.operatorPin ?? ''];
  if (!pins.every((pin) => typeof pin === 'string' && isOptionalPin(pin))) {
    return null;
  }
  const camera =
    typeof values.camera === 'string' && values.camera.trim()
      ? values.camera
      : DEFAULT_CAMERA;
  const layouts =
    Array.isArray(values.layouts) &&
    values.layouts.length > 0 &&
    values.layouts.every((layout) => typeof layout === 'string')
      ? (values.layouts as string[])
      : [DEFAULT_LAYOUT];
  return { camera, layouts };
}

/**
 * Start configuration from the saved settings, or `null` when nothing has been
 * saved yet (first run) or the saved values would not start.
 */
export function savedStartConfig(
  settings: readonly Setting[],
): StartConfig | null {
  if (settings.length === 0) {
    return null;
  }
  return resolveStartConfig({
    camera: readSettingValue(settings, 'camera'),
    layouts: readSettingValue(settings, 'layouts'),
    galleryPassword: readSettingValue(settings, 'galleryPassword'),
    operatorPin: readSettingValue(settings, 'operatorPin'),
  });
}

/**
 * Brings the booth into the guest flow: initialises the camera (when it isn't
 * ready yet), starts the live view and opens the entry layout. Shared by
 * "Fotobox starten", auto-start and "back to the Fotobox" on the PIN gate.
 */
@Injectable({ providedIn: 'root' })
export class FotoboxStartService {
  private readonly cameraStore = inject(CameraStore);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly clientLog = inject(ClientLogService);
  private readonly translate = inject(TranslateService);
  private readonly camera$ = toObservable(this.cameraStore.camera$);

  readonly starting = signal(false);
  /** Why the last start failed; cleared when a new start begins. */
  readonly error = signal<string | null>(null);

  /** Resolves `true` once the guest flow is open. */
  async start(config: StartConfig): Promise<boolean> {
    this.error.set(null);
    this.starting.set(true);
    try {
      const ready = await this.ensureCamera(config.camera);
      if (!ready.ok) {
        const message =
          ready.error || this.translate.instant('SETTINGS.START_FAILED');
        this.error.set(message);
        this.clientLog.error('Fotobox start failed', message);
        return false;
      }
      if (!this.cameraStore.isLiveViewActive()) {
        this.cameraStore.startLiveView();
      }
      await this.navigateToGuestFlow(config.layouts);
      return true;
    } finally {
      this.starting.set(false);
    }
  }

  private async ensureCamera(
    driver: string,
  ): Promise<{ ok: boolean; error?: string | null }> {
    const current = this.cameraStore.currentCamera();
    if (current && current.driver !== 'none' && current.available) {
      return { ok: true };
    }

    this.cameraStore.initializeCamera(driver);
    const { currentCamera, error } = await firstValueFrom(
      this.camera$.pipe(
        filter(({ isLoading }) => !isLoading),
        filter(
          ({ currentCamera, error }) =>
            !!error || currentCamera?.driver === driver,
        ),
        take(1),
      ),
    );
    const ok =
      !!currentCamera &&
      currentCamera.driver === driver &&
      currentCamera.available;
    return { ok, error };
  }

  private async navigateToGuestFlow(layouts: string[]): Promise<void> {
    try {
      // Prefer the given layouts — a save may still be persisting to the store.
      if (layouts.length === 1) {
        await this.layoutNavigation.navigateToLayout(layouts[0]);
      } else {
        await this.layoutNavigation.navigateToEntryPoint();
      }
    } catch (err) {
      console.error('Navigation after start failed:', err);
    }
  }
}
