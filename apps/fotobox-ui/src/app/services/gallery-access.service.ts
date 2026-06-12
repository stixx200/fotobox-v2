import { Injectable, inject, signal } from '@angular/core';
import { SettingsStore } from '../store';
import { isGalleryPin } from './gallery-pin.util';

/**
 * Session-scoped gallery access control. The PIN is stored in settings; this
 * service only tracks whether the current session has unlocked the gallery.
 */
@Injectable({ providedIn: 'root' })
export class GalleryAccessService {
  private readonly settingsStore = inject(SettingsStore);

  readonly unlocked = signal(false);

  configuredPassword(): string {
    const setting = this.settingsStore
      .settings()
      .find((s) => s.key === 'galleryPassword');
    if (!setting) {
      return '';
    }
    try {
      const value = JSON.parse(setting.value);
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  }

  /** Whether the gallery entry button is shown and the route is reachable. */
  isGalleryEnabled(): boolean {
    const setting = this.settingsStore
      .settings()
      .find((s) => s.key === 'showGalleryButton');
    if (!setting) {
      return false;
    }
    try {
      return JSON.parse(setting.value) === true;
    } catch {
      return false;
    }
  }

  /** Gallery is locked only when a valid 4-digit PIN is configured. */
  requiresPassword(): boolean {
    return isGalleryPin(this.configuredPassword());
  }

  validate(password: string): boolean {
    return password === this.configuredPassword();
  }

  unlock(): void {
    this.unlocked.set(true);
  }

  lock(): void {
    this.unlocked.set(false);
  }
}
