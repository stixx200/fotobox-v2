import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraStore } from '../../store/camera.store';
import { CameraService } from '../../services/camera.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-camera-live-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-live-view.component.html',
  styleUrl: './camera-live-view.component.scss',
})
export class CameraLiveViewComponent implements OnInit, OnDestroy {
  private readonly cameraStore = inject(CameraStore);
  private readonly cameraService = inject(CameraService);

  private liveViewSubscription?: Subscription;
  private initTimeout?: any;

  readonly liveFrame = signal<string | null>(null);
  readonly isActive = this.cameraStore.isLiveViewActive;
  readonly error = this.cameraStore.error;
  readonly debugInfo = signal<string>('Initializing...');

  constructor() {
    // Watch for live view activation
    effect(() => {
      const isActive = this.cameraStore.isLiveViewActive();
      const timestamp = new Date().toISOString();
      console.log(
        `[CameraLiveView ${timestamp}] Effect triggered - Live view active state: ${isActive}`,
      );
      this.debugInfo.set(`Live view active: ${isActive}`);

      if (isActive) {
        console.log(
          `[CameraLiveView ${timestamp}] Calling subscribeLiveViewFrames()`,
        );
        this.subscribeLiveViewFrames();
      } else {
        console.log(
          `[CameraLiveView ${timestamp}] Calling unsubscribeLiveViewFrames()`,
        );
        this.unsubscribeLiveViewFrames();
      }
    });

    // Watch for errors
    effect(() => {
      const err = this.cameraStore.error();
      if (err) {
        const timestamp = new Date().toISOString();
        console.error(`[CameraLiveView ${timestamp}] Store error:`, err);
        this.debugInfo.set(`Error: ${err}`);
      }
    });
  }

  ngOnInit() {
    const timestamp = new Date().toISOString();
    console.log(`[CameraLiveView ${timestamp}] ===== Component mounted =====`);

    // Check if camera is already initialized
    const currentCamera = this.cameraStore.currentCamera();
    const isLiveViewActive = this.cameraStore.isLiveViewActive();

    console.log(`[CameraLiveView ${timestamp}] State check:`);
    console.log(`  - Camera:`, currentCamera);
    console.log(`  - Live view active:`, isLiveViewActive);
    console.log(
      `  - Has existing subscription:`,
      !!this.liveViewSubscription && !this.liveViewSubscription.closed,
    );

    if (
      currentCamera &&
      currentCamera.available &&
      currentCamera.driver !== 'none'
    ) {
      if (!isLiveViewActive) {
        // Camera is ready but live view not started, start it
        console.log(
          `[CameraLiveView ${timestamp}] Camera ready but live view not active - starting it`,
        );
        this.debugInfo.set(
          `Starting live view with ${currentCamera.driver}...`,
        );
        this.cameraStore.startLiveView();
      } else {
        // Live view already active, just subscribe to frames
        console.log(
          `[CameraLiveView ${timestamp}] Live view already active - effect will handle subscription`,
        );
        this.debugInfo.set(`Live view active with ${currentCamera.driver}`);
        // The effect will handle subscribing when isLiveViewActive is true
      }
    } else {
      // Camera not ready yet, wait for it to be initialized by app component
      console.log(
        `[CameraLiveView ${timestamp}] Waiting for camera initialization...`,
      );
      this.debugInfo.set('Waiting for camera...');

      // Check status periodically until camera is ready
      this.initTimeout = setInterval(() => {
        const camera = this.cameraStore.currentCamera();
        const liveViewActive = this.cameraStore.isLiveViewActive();
        if (camera && camera.available && camera.driver !== 'none') {
          const checkTime = new Date().toISOString();
          console.log(
            `[CameraLiveView ${checkTime}] Camera now ready (from interval check)`,
          );
          clearInterval(this.initTimeout);

          if (!liveViewActive) {
            console.log(`[CameraLiveView ${checkTime}] Starting live view`);
            this.debugInfo.set(`Starting live view with ${camera.driver}...`);
            this.cameraStore.startLiveView();
          } else {
            console.log(
              `[CameraLiveView ${checkTime}] Live view already active`,
            );
            this.debugInfo.set(`Live view active with ${camera.driver}`);
          }
        }
      }, 500);
    }
  }

  ngOnDestroy() {
    const timestamp = new Date().toISOString();
    const isLiveViewActive = this.cameraStore.isLiveViewActive();

    console.log(
      `[CameraLiveView ${timestamp}] ===== Component unmounting =====`,
    );
    console.log(`  - Live view active: ${isLiveViewActive}`);
    console.log(
      `  - Has subscription: ${!!this.liveViewSubscription && !this.liveViewSubscription.closed}`,
    );
    console.log(`  - Keeping live view running in background`);

    if (this.initTimeout) {
      clearInterval(this.initTimeout);
    }
    // Only unsubscribe from frames, don't stop live view
    this.unsubscribeLiveViewFrames();
  }

  private subscribeLiveViewFrames() {
    const timestamp = new Date().toISOString();

    // Avoid duplicate subscriptions
    if (this.liveViewSubscription && !this.liveViewSubscription.closed) {
      console.log(
        `[CameraLiveView ${timestamp}] Already subscribed to live view - skipping`,
      );
      return;
    }

    console.log(
      `[CameraLiveView ${timestamp}] Creating new GraphQL subscription for live view frames`,
    );
    this.liveViewSubscription = this.cameraService
      .subscribeLiveView()
      .subscribe({
        next: (frame) => {
          console.log(
            `[CameraLiveView] Received frame at ${frame.timestamp} (data: ${frame.data.substring(0, 50)}...)`,
          );
          // The frame.data is base64 encoded image
          this.liveFrame.set(frame.data);
        },
        error: (error) => {
          console.error(
            `[CameraLiveView ${timestamp}] Live view subscription error:`,
            error,
          );
        },
        complete: () => {
          console.log(
            `[CameraLiveView ${timestamp}] Live view subscription completed`,
          );
        },
      });
    console.log(
      `[CameraLiveView ${timestamp}] GraphQL subscription created successfully`,
    );
  }

  private unsubscribeLiveViewFrames() {
    const timestamp = new Date().toISOString();
    if (this.liveViewSubscription) {
      console.log(
        `[CameraLiveView ${timestamp}] Unsubscribing from live view frames`,
      );
      this.liveViewSubscription.unsubscribe();
      this.liveViewSubscription = undefined;
      console.log(`[CameraLiveView ${timestamp}] Unsubscribed successfully`);
    } else {
      console.log(
        `[CameraLiveView ${timestamp}] No subscription to unsubscribe`,
      );
    }
  }
}
