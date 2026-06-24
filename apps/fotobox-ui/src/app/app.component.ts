import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiHealthService } from './services/api-health.service';
import { SplashScreenComponent } from './splash-screen.component';
import { RecoveryOverlayComponent } from './recovery-overlay.component';
import { CameraStore } from './store/camera.store';
import { IdleService } from './services/idle.service';
import { ClientLogService } from './services/client-log.service';
import { RecoveryService } from './services/recovery.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SplashScreenComponent,
    RecoveryOverlayComponent,
    TranslatePipe,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'fotobox-ui';
  readonly isApiReady = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly showRouter = signal(false);
  readonly recovery = inject(RecoveryService);
  private readonly router = inject(Router);
  private readonly cameraStore = inject(CameraStore);
  private readonly clientLogService = inject(ClientLogService);
  private readonly translateService = inject(TranslateService);
  // Activating the idle service here starts the idle timer for the whole app.
  private readonly _idle = inject(IdleService);

  constructor(private apiHealthService: ApiHealthService) {}

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
    try {
      const isReady = await this.apiHealthService.waitForApiReady();
      if (isReady) {
        this.isApiReady.set(true);
        this.apiError.set(null);
        this.recovery.clearNetworkDegraded();
        this.updateShowRouter();
        return;
      }

      const message = this.translateService.instant('SPLASH.API_UNAVAILABLE');
      this.apiError.set(message);
      this.clientLogService.error('Backend API unreachable', message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : this.translateService.instant('SPLASH.API_UNAVAILABLE');
      this.apiError.set(message);
      this.clientLogService.error('Error waiting for API', error);
    }
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
