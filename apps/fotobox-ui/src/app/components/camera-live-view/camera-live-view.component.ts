import {
  Component,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraStore } from '../../store/camera.store';
import { WebcamService } from '../../services/webcam.service';

/**
 * Shows the live camera preview. Supports two sources:
 * - Server cameras (demo/sony/gphoto2): streams base64 frames via the GraphQL
 *   `liveViewStream` subscription.
 * - The browser webcam (client camera): renders a `<video>` element fed by
 *   {@link WebcamService} and can capture a still frame on demand.
 */
@Component({
  selector: 'app-camera-live-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-live-view.component.html',
  styleUrl: './camera-live-view.component.scss',
})
export class CameraLiveViewComponent implements OnDestroy {
  private readonly cameraStore = inject(CameraStore);
  private readonly webcam = inject(WebcamService);

  /** The `<video>` element used for the webcam preview (client camera only). */
  private readonly videoRef =
    viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  readonly isClient = this.cameraStore.isClientCamera;
  /** Latest frame — reads directly from the store so no spinner on layout switch. */
  readonly liveFrame = computed(() => this.cameraStore.lastLiveFrame()?.data ?? null);

  private readonly localError = signal<string | null>(null);
  readonly error = computed(
    () => this.localError() ?? this.cameraStore.error(),
  );
  readonly statusMessage = signal('Kamera wird gestartet …');

  private webcamStarted = false;

  constructor() {
    // Client webcam: start the preview once the video element is available.
    effect(() => {
      if (!this.isClient()) {
        return;
      }
      const element = this.videoRef()?.nativeElement;
      if (element && !this.webcamStarted) {
        this.webcamStarted = true;
        this.startWebcam(element);
      }
    });
  }

  /**
   * Capture the current webcam frame as base64 JPEG (no data URI prefix).
   * Returns null when the webcam is not the active source or not ready.
   */
  captureFrame(): string | null {
    if (!this.isClient()) {
      return null;
    }
    const element = this.videoRef()?.nativeElement;
    if (!element) {
      return null;
    }
    try {
      return this.webcam.capture(element);
    } catch (error) {
      this.localError.set(
        error instanceof Error ? error.message : 'Aufnahme fehlgeschlagen',
      );
      return null;
    }
  }

  ngOnDestroy(): void {
    // Live-view subscription is managed by the store; nothing to tear down here.
  }

  private async startWebcam(element: HTMLVideoElement): Promise<void> {
    try {
      this.statusMessage.set('Webcam wird gestartet …');
      await this.webcam.start(element);
      this.localError.set(null);
    } catch (error) {
      this.webcamStarted = false;
      this.localError.set(
        error instanceof Error
          ? error.message
          : 'Webcam konnte nicht gestartet werden',
      );
    }
  }
}
