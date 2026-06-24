import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CameraStore } from '../store';

const ESCAPE_TAPS_REQUIRED = 5;
const ESCAPE_TAP_RESET_MS = 3000;

/**
 * Hidden multi-tap gesture (top-left corner) to return to settings without
 * showing visible navigation chrome on kiosk screens.
 */
@Injectable({ providedIn: 'root' })
export class SettingsEscapeService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly cameraStore = inject(CameraStore);

  private escapeTimer: ReturnType<typeof setTimeout> | null = null;
  readonly tapCount = signal(0);

  onTap(): void {
    const next = this.tapCount() + 1;
    this.tapCount.set(next);

    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
    }
    this.escapeTimer = setTimeout(() => {
      this.tapCount.set(0);
      this.escapeTimer = null;
    }, ESCAPE_TAP_RESET_MS);

    if (next >= ESCAPE_TAPS_REQUIRED) {
      if (this.escapeTimer) {
        clearTimeout(this.escapeTimer);
        this.escapeTimer = null;
      }
      this.tapCount.set(0);
      this.navigateToSettings();
    }
  }

  navigateToSettings(): void {
    this.cameraStore.stopLiveView();
    void this.router.navigate(['/settings']);
  }

  ngOnDestroy(): void {
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
    }
  }
}
