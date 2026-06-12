import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LayoutNavigationService } from './layout-navigation.service';

const IDLE_ROUTES = ['/layouts/single', '/layouts/collage'];
const IDLE_TIMEOUT_MS = 60_000; // 1 minute with no interaction

/**
 * Watches for user inactivity (no touch/click/keyboard events) while on a
 * layout route. After {@link IDLE_TIMEOUT_MS} the user is silently returned
 * to the home screen so the kiosk never gets stuck on a photo.
 *
 * The service is root-scoped and self-managing — just inject it once (e.g.
 * in AppComponent) to activate it.
 */
@Injectable({ providedIn: 'root' })
export class IdleService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly ngZone = inject(NgZone);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  private readonly boundReset = this.reset.bind(this);

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = (e as NavigationEnd).urlAfterRedirects;
        if (IDLE_ROUTES.some((r) => url.startsWith(r))) {
          this.activate();
        } else {
          this.deactivate();
        }
      });
  }

  private activate(): void {
    if (this.active) return;
    this.active = true;
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('touchstart', this.boundReset, { passive: true });
      window.addEventListener('click', this.boundReset, { passive: true });
      window.addEventListener('keydown', this.boundReset, { passive: true });
    });
    this.schedule();
  }

  private deactivate(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('touchstart', this.boundReset);
    window.removeEventListener('click', this.boundReset);
    window.removeEventListener('keydown', this.boundReset);
    this.cancel();
  }

  private reset(): void {
    this.cancel();
    this.schedule();
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.ngZone.run(() => this.layoutNavigation.navigateToEntryPoint());
    }, IDLE_TIMEOUT_MS);
  }

  private cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.deactivate();
  }
}
