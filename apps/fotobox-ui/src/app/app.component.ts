import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiHealthService } from './services/api-health.service';
import { SplashScreenComponent } from './splash-screen.component';
import { CameraStore } from './store/camera.store';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SplashScreenComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'fotobox-ui';
  isApiReady = false;
  private readonly cameraStore = inject(CameraStore);

  constructor(private apiHealthService: ApiHealthService) {}

  ngOnInit() {
    this.waitForApi();
  }

  private async waitForApi() {
    try {
      const isReady = await this.apiHealthService.waitForApiReady();
      this.isApiReady = isReady;

      if (!isReady) {
        console.error('Failed to connect to backend API');
        // Retry after delay
        setTimeout(() => this.waitForApi(), 2000);
      }
    } catch (error) {
      console.error('Error waiting for API:', error);
      // Retry after delay
      setTimeout(() => this.waitForApi(), 2000);
    }
  }

  /**
   * Initialize camera once on user request
   * Camera state will be maintained throughout navigation
   */
  initializeCamera() {
    console.log('[App] Initializing camera on user request');

    // Load available cameras and status
    this.cameraStore.loadAvailableCameras();
    this.cameraStore.loadCameraStatus();

    // Wait a bit for status to load, then initialize demo camera if needed
    setTimeout(() => {
      const currentCamera = this.cameraStore.currentCamera();
      console.log('[App] Current camera status:', currentCamera);

      if (
        !currentCamera ||
        currentCamera.driver === 'none' ||
        !currentCamera.available
      ) {
        console.log('[App] No camera initialized, initializing demo camera');
        this.cameraStore.initializeCamera('demo');

        // Start live view after initialization
        setTimeout(() => {
          console.log('[App] Starting live view after camera initialization');
          this.cameraStore.startLiveView();
        }, 1000);
      } else {
        console.log('[App] Camera already initialized:', currentCamera.driver);

        // Check if live view is active, if not start it
        const isLiveViewActive = this.cameraStore.isLiveViewActive();
        if (!isLiveViewActive) {
          console.log('[App] Starting live view with existing camera');
          this.cameraStore.startLiveView();
        } else {
          console.log('[App] Live view already active');
        }
      }
    }, 500);
  }
}
