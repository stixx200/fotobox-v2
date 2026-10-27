import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiHealthService } from './services/api-health.service';
import { SplashScreenComponent } from './splash-screen.component';
import { RecoveryOverlayComponent } from './recovery-overlay.component';
import { CameraStore } from './store/camera.store';
import { IdleService } from './services/idle.service';
import { ClientLogService } from './services/client-log.service';
import { RecoveryService } from './services/recovery.service';

/** Show the "starting takes a while" hint after this long. */
const SLOW_START_MS = 20_000;
/** Background check interval after the splash screen gave up. */
const BACKGROUND_RETRY_MS = 15_000;

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SplashScreenComponent,
    RecoveryOverlayComponent,
    TranslatePipe,
    MatButtonModule,
    MatIconModule,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'fotobox-ui';
  readonly isApiReady = signal(false);
  readonly apiError = signal<string | null>(null);
  /** The API takes longer than usual to start (shown on the splash screen). */
  readonly slowStart = signal(false);
  readonly showRouter = signal(false);
  readonly recovery = inject(RecoveryService);
  private readonly router = inject(Router);
  private readonly cameraStore = inject(CameraStore);
  private readonly clientLogService = inject(ClientLogService);
  private readonly translateService = inject(TranslateService);
  // Activating the idle service here starts the idle timer for the whole app.
  private readonly _idle = inject(IdleService);
  private readonly apiHealthService = inject(ApiHealthService);
  /** Ignores results of a wait that "Retry" replaced. */
  private waitAttempt = 0;

  ngOnInit() {
    this.updateShowRouter();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.updateShowRouter());
    this.waitForApi();
  }

  private updateShowRouter(): void {
    const onDebugPage = this.router.url.includes('/debug');
    this.showRouter.set(this.isApiReady() || onDebugPage);
  }

  retryApi(): void {
    this.waitForApi();
  }

  private async waitForApi() {
    this.apiError.set(null);
    this.slowStart.set(false);
    const attempt = ++this.waitAttempt;
    const slowTimer = setTimeout(() => this.slowStart.set(true), SLOW_START_MS);
    try {
      const isReady = await this.apiHealthService.waitForApiReady();
      if (attempt !== this.waitAttempt) {
        return;
      }
      if (isReady) {
        this.onApiReady();
        return;
      }

      const message = this.translateService.instant('SPLASH.API_UNAVAILABLE');
      this.apiError.set(message);
      this.clientLogService.error('Backend API unreachable', message);
      this.keepTrying(attempt);
    } catch (error) {
      // Raw error details go to the log (debug page), never on screen.
      this.apiError.set(
        this.translateService.instant('SPLASH.API_UNAVAILABLE'),
      );
      this.clientLogService.error('Error waiting for API', error);
      this.keepTrying(attempt);
    } finally {
      clearTimeout(slowTimer);
    }
  }

  /**
   * After giving up, keep checking in the background so an unattended kiosk
   * comes up on its own once the API is there ("Retry" checks at once).
   */
  private async keepTrying(attempt: number) {
    while (attempt === this.waitAttempt && !this.isApiReady()) {
      await new Promise((resolve) => setTimeout(resolve, BACKGROUND_RETRY_MS));
      if (attempt !== this.waitAttempt) {
        return;
      }
      if (await this.apiHealthService.isApiReachable()) {
        this.onApiReady();
        return;
      }
    }
  }

  private onApiReady(): void {
    this.isApiReady.set(true);
    this.apiError.set(null);
    this.slowStart.set(false);
    this.recovery.clearNetworkDegraded();
    this.updateShowRouter();
  }

  /**
   * Initialize camera once on user request
   * Camera state will be maintained throughout navigation
   */
  initializeCamera() {
    // Load available cameras and status
    this.cameraStore.loadAvailableCameras();
    this.cameraStore.loadCameraStatus();

    // Wait a bit for status to load, then initialize demo camera if needed
    setTimeout(() => {
      const currentCamera = this.cameraStore.currentCamera();

      if (
        !currentCamera ||
        currentCamera.driver === 'none' ||
        !currentCamera.available
      ) {
        this.cameraStore.initializeCamera('demo');

        // Start live view after initialization
        setTimeout(() => {
          this.cameraStore.startLiveView();
        }, 1000);
      } else {
        // Check if live view is active, if not start it
        const isLiveViewActive = this.cameraStore.isLiveViewActive();
        if (!isLiveViewActive) {
          this.cameraStore.startLiveView();
        }
      }
    }, 500);
  }
}
