import { Injectable } from '@angular/core';

/**
 * Handles the browser-driven (client) webcam used when the selected camera is
 * the `webcam` driver. It manages a `getUserMedia` stream for live preview and
 * captures still frames as base64 JPEG for upload to the server.
 */
@Injectable({ providedIn: 'root' })
export class WebcamService {
  private stream: MediaStream | null = null;

  /**
   * Whether the browser exposes the getUserMedia API.
   */
  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Start the webcam stream and attach it to the given video element for a
   * live preview. Reuses an existing stream if already started.
   */
  async start(video: HTMLVideoElement): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Webcam is not supported in this browser');
    }

    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    }

    video.srcObject = this.stream;
    video.muted = true;
    await video.play();
  }

  /**
   * Capture the current frame from the video element as a base64-encoded JPEG
   * (without the data URI prefix), suitable for the uploadPhoto mutation.
   */
  capture(video: HTMLVideoElement, quality = 0.92): string {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new Error('Webcam stream is not ready yet');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D canvas context');
    }
    context.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    // Strip the "data:image/jpeg;base64," prefix; the server accepts either.
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
  }

  /**
   * Stop the webcam stream and release the device.
   */
  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}
