import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SettingsStore } from '../store';
import { isPin } from './pin.util';
import { readBooleanSetting, readStringSetting } from './settings-value.util';

/** Routes guests use; entering one locks the settings again. */
export const GUEST_ROUTES = ['/home', '/layouts', '/gallery'];

/**
 * Session-scoped operator access: whether the settings are protected by an
 * operator PIN, whether this visit has unlocked them, and the auto-start
 * preference. Settings are unlocked until the booth returns to the guest flow.
 */
@Injectable({ providedIn: 'root' })
export class OperatorAccessService {
  private readonly settingsStore = inject(SettingsStore);

  readonly unlocked = signal(false);
  private autoStartHandled = false;

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = (e as NavigationEnd).urlAfterRedirects;
        if (GUEST_ROUTES.some((route) => url.startsWith(route))) {
          this.lock();
        }
      });
  }

  configuredPin(): string {
    return readStringSetting(this.settingsStore.settings(), 'operatorPin');
  }

  /** Settings are protected only when a valid 4-digit PIN is configured. */
  requiresPin(): boolean {
    return isPin(this.configuredPin());
  }

  /** Whether the settings may be shown right now. */
  isOpen(): boolean {
    return !this.requiresPin() || this.unlocked();
  }

  /** Checks the PIN and unlocks the settings for this visit when it matches. */
  tryUnlock(pin: string): boolean {
    if (!this.requiresPin() || pin === this.configuredPin()) {
      this.unlocked.set(true);
      return true;
    }
    return false;
  }

  lock(): void {
    this.unlocked.set(false);
  }

  autoStartEnabled(): boolean {
    return readBooleanSetting(this.settingsStore.settings(), 'autoStart');
  }

  /**
   * Auto-start is considered once per app launch only, so returning to the
   * start route later (e.g. a reload by the operator) never skips settings.
   */
  claimAutoStart(): boolean {
    if (this.autoStartHandled) {
      return false;
    }
    this.autoStartHandled = true;
    return true;
  }
}
