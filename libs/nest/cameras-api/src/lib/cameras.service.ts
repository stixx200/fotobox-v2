import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import {
  CameraFactory,
  CameraInterface,
  WEBCAM_DRIVER,
} from '@fotobox/cameras';
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';
import { CameraInfo } from './models/camera.model';
import { Subscription, Subject, map, Observable, ReplaySubject } from 'rxjs';

const logger = getLogger('CameraService');

export interface PhotoSavedEvent {
  photoId: string;
  path: string;
  timestamp: string;
}

@Injectable()
export class CameraService implements OnModuleDestroy {
  private currentCamera: CameraInterface | null = null;
  /** Set when a browser-driven (client) camera such as the webcam is active. */
  private clientDriver: string | null = null;
  private liveViewSubscription: Subscription | null = null;
  private liveViewSubject = new ReplaySubject<string>(1);
  private liveViewSubscriptionCount = 0;

  constructor(private photoStorage: PhotoStorageProviderService) {}

  async getAvailableCameras(): Promise<CameraInfo[]> {
    logger.debug('Fetching available cameras');

    const activeDriver = this.getCurrentDriver();

    return CameraFactory.describeCameras().map((descriptor) => ({
      driver: descriptor.driver,
      location: descriptor.location,
      capabilities: descriptor.capabilities,
      available: descriptor.available,
      status:
        descriptor.driver === activeDriver
          ? 'active'
          : descriptor.available
            ? 'available'
            : 'unavailable',
    }));
  }

  async getCameraStatus(): Promise<CameraInfo> {
    logger.debug('Fetching camera status');

    if (this.clientDriver) {
      return {
        driver: this.clientDriver,
        status: 'active',
        available: true,
        location: 'client',
        capabilities: { liveView: true },
      };
    }

    if (!this.currentCamera) {
      return {
        driver: 'none',
        status: 'not initialized',
        available: false,
        location: 'server',
        capabilities: { liveView: false },
      };
    }

    return {
      driver: this.currentCamera.driver,
      status: this.currentCamera.isAvailable() ? 'active' : 'error',
      available: this.currentCamera.isAvailable(),
      location: 'server',
      capabilities: { liveView: true },
    };
  }

  async initializeCamera(driver: string): Promise<boolean> {
    logger.info(`Initializing camera with driver: ${driver}`);

    // Deinitialize current server camera if one exists.
    if (this.currentCamera) {
      await this.deinitializeCamera();
    }
    this.clientDriver = null;

    // The webcam is driven by the browser; there is no server instance.
    if (driver.toLowerCase() === WEBCAM_DRIVER) {
      this.clientDriver = WEBCAM_DRIVER;
      logger.info('Webcam (client) camera selected; no server instance.');
      return true;
    }

    // Create and initialize new camera
    this.currentCamera = CameraFactory.createCamera(driver);
    await this.currentCamera.init();

    logger.info(`Camera ${driver} initialized successfully`);
    return true;
  }

  /**
   * Persist an uploaded photo (e.g. from the browser webcam) and return its
   * saved-event descriptor so callers can broadcast a pictureTaken event.
   */
  savePhoto(imageData: string): PhotoSavedEvent {
    return this.handleCapturedPicture(imageData);
  }

  /**
   * Handle a captured picture by saving it to storage
   */
  private handleCapturedPicture(pictureData: string): PhotoSavedEvent {
    const photoId = `photo-${Date.now()}`;

    // Convert picture data to buffer
    let photoBuffer: Buffer;

    // Check if pictureData is base64 encoded
    if (
      pictureData.startsWith('data:') ||
      pictureData.match(/^[A-Za-z0-9+/=]+$/)
    ) {
      // Extract base64 data if it has the data URI scheme
      const base64Data = pictureData.includes(',')
        ? pictureData.split(',')[1]
        : pictureData;
      photoBuffer = Buffer.from(base64Data, 'base64');
    } else if (pictureData.startsWith('/') || pictureData.includes('.')) {
      // It's a file path - in this case, log and skip
      // (in production you might read the file)
      logger.debug(`Captured picture at path: ${pictureData}`);
      throw new Error(
        'Received picture as file path, but file handling is not implemented in this example',
      );
    } else {
      // Try to treat as buffer or raw binary data
      photoBuffer = Buffer.from(pictureData);
    }

    // Save photo to storage
    const filePath = this.photoStorage.savePhoto(photoId, photoBuffer);
    logger.info(`Photo saved to ${filePath}`);

    // Return relative path for URL access
    const relativePath = `/api/photos/${photoId}.jpg`;

    // Emit photo saved event
    return {
      photoId,
      path: relativePath,
      timestamp: new Date().toISOString(),
    };
  }

  async deinitializeCamera(): Promise<void> {
    this.stopLiveViewInternal();
    this.clientDriver = null;
    if (this.currentCamera) {
      logger.info(`Deinitializing camera: ${this.currentCamera.driver}`);
      await this.currentCamera.deinit();
      this.currentCamera = null;
    }
  }

  /**
   * Cleanup on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    await this.deinitializeCamera();
  }

  async takePicture(): Promise<void> {
    logger.info('Taking picture');

    if (!this.currentCamera) {
      throw new Error('Camera not initialized');
    }

    await this.currentCamera.takePicture();
  }

  /**
   * Start live view subscription with reference counting
   * Ensures only one subscription to the camera's live view exists
   */
  startLiveView(): Observable<string> {
    this.liveViewSubscriptionCount++;
    logger.debug(
      `Live view subscription count: ${this.liveViewSubscriptionCount}`,
    );

    // Only subscribe to camera if this is the first subscriber
    if (this.liveViewSubscriptionCount === 1 && this.currentCamera) {
      logger.debug('Starting live view stream from camera');
      this.liveViewSubscription = this.currentCamera
        .observeLiveView()
        .subscribe({
          next: (data) => {
            this.liveViewSubject.next(data);
          },
          error: (error) => {
            logger.error('Error in camera live view stream:', error);
            this.liveViewSubject.error(error);
          },
        });
    }

    return this.liveViewSubject.asObservable();
  }

  /**
   * Stop live view subscription with reference counting
   */
  stopLiveView(): void {
    this.liveViewSubscriptionCount--;
    logger.debug(
      `Live view subscription count: ${this.liveViewSubscriptionCount}`,
    );

    // Only unsubscribe from camera when last subscriber disconnects
    if (this.liveViewSubscriptionCount <= 0) {
      this.stopLiveViewInternal();
    }
  }

  /**
   * Internal method to stop the live view subscription
   */
  private stopLiveViewInternal(): void {
    if (this.liveViewSubscription) {
      logger.debug('Stopping live view stream from camera');
      this.liveViewSubscription.unsubscribe();
      this.liveViewSubscription = null;
    }
    this.liveViewSubscriptionCount = 0;
    this.liveViewSubject = new ReplaySubject<string>(1);
  }

  /**
   * Get the current camera instance for live view streaming
   */
  getCurrentCamera(): CameraInterface | null {
    return this.currentCamera;
  }

  /**
   * Get the current driver name (server camera or active client driver)
   */
  getCurrentDriver(): string | null {
    return this.currentCamera?.driver ?? this.clientDriver ?? null;
  }

  /**
   * Observable for saved photos
   */
  getPictureTaken$(): Observable<PhotoSavedEvent> {
    if (!this.currentCamera) {
      throw new Error('Camera not initialized');
    }
    return (
      this.currentCamera
        .observePictures()
        .pipe(map((pictureData) => this.handleCapturedPicture(pictureData))) ??
      null
    );
  }
}
