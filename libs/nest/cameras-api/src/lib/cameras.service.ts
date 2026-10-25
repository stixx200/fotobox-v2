import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { PubSub } from 'graphql-subscriptions';
import { getLogger } from '@fotobox/logging';
import { FotoboxError } from '@fotobox/error';
import {
  CameraFactory,
  CameraInterface,
  WEBCAM_DRIVER,
} from '@fotobox/cameras';
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';
import { CameraInfo, LiveViewFrame, Picture } from './models/camera.model';
import {
  EMPTY,
  firstValueFrom,
  mergeMap,
  Observable,
  of,
  ReplaySubject,
  Subject,
  Subscription,
  timeout,
  TimeoutError,
} from 'rxjs';

const logger = getLogger('CameraService');

const LIVE_VIEW_TOPIC = 'liveView';
const PICTURE_TAKEN_TOPIC = 'pictureTaken';

const TAKE_PICTURE_TIMEOUT_MS = 30_000;

/**
 * Decode picture data from a camera driver or client upload. Accepts raw
 * base64 or a `data:` URL; only JPEG is supported because photos are stored
 * and served as `.jpg`.
 */
export function decodeJpegPicture(pictureData: string): Buffer {
  const dataUrlPrefix = /^data:[^,]*,/.exec(pictureData);
  const base64 = (
    dataUrlPrefix ? pictureData.slice(dataUrlPrefix[0].length) : pictureData
  ).replace(/\s+/g, '');

  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new FotoboxError('Picture data is not valid base64.', {
      code: 'MAIN.CAMERA.UNSUPPORTED_PICTURE_FORMAT',
    });
  }

  const buffer = Buffer.from(base64, 'base64');
  const isJpeg =
    buffer.length > 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  if (!isJpeg) {
    throw new FotoboxError('Picture data is not a JPEG image.', {
      code: 'MAIN.CAMERA.UNSUPPORTED_PICTURE_FORMAT',
    });
  }
  return buffer;
}

/** Unique, time-sortable photo id (`photo-<ms>-<random>`). */
export function createPhotoId(now = Date.now()): string {
  return `photo-${now}-${crypto.randomBytes(3).toString('hex')}`;
}

export interface PhotoSavedEvent {
  photoId: string;
  path: string;
  timestamp: string;
}

@Injectable()
export class CameraService implements OnModuleDestroy {
  private currentCamera: CameraInterface | null = null;
  private clientDriver: string | null = null;
  private liveViewSubscription: Subscription | null = null;
  private liveViewSubject = new ReplaySubject<string>(1);
  private liveViewSubscriptionCount = 0;
  private readonly pictureReady$ = new Subject<Picture>();
  /** Pictures produced by the server camera only (not client uploads). */
  private readonly cameraPicture$ = new Subject<Picture>();
  private pendingCapture: Promise<Picture> | null = null;
  private pictureTakenServerSubscription: Subscription | null = null;
  private liveViewBroadcastSubscription: Subscription | null = null;

  constructor(
    private photoStorage: PhotoStorageProviderService,
    private readonly pubSub: PubSub,
  ) {}

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

    if (this.currentCamera) {
      await this.deinitializeCamera();
    }
    this.clientDriver = null;

    if (driver.toLowerCase() === WEBCAM_DRIVER) {
      this.clientDriver = WEBCAM_DRIVER;
      logger.info('Webcam (client) camera selected; no server instance.');
      return true;
    }

    this.currentCamera = CameraFactory.createCamera(driver);
    await this.currentCamera.init();

    logger.info(`Camera ${driver} initialized successfully`);
    return true;
  }

  startPictureTakenBroadcast(driver: string): void {
    this.pictureTakenServerSubscription?.unsubscribe();
    this.pictureTakenServerSubscription = null;

    if (driver.toLowerCase() === WEBCAM_DRIVER) {
      return;
    }

    this.pictureTakenServerSubscription = this.getPictureTaken$().subscribe(
      (pictureData) => {
        const picture: Picture = {
          id: pictureData.photoId,
          timestamp: pictureData.timestamp,
          path: pictureData.path,
        };
        this.cameraPicture$.next(picture);
        this.publishPicture(picture);
      },
    );
  }

  publishPicture(picture: Picture): void {
    this.pictureReady$.next(picture);
    void this.pubSub.publish(PICTURE_TAKEN_TOPIC, { pictureTaken: picture });
  }

  getPictureReady$(): Observable<Picture> {
    return this.pictureReady$.asObservable();
  }

  savePhoto(imageData: string): PhotoSavedEvent {
    return this.handleCapturedPicture(imageData);
  }

  uploadAndBroadcastPhoto(imageData: string): Picture {
    const saved = this.savePhoto(imageData);
    const picture: Picture = {
      id: saved.photoId,
      timestamp: saved.timestamp,
      path: saved.path,
    };
    this.publishPicture(picture);
    return picture;
  }

  /**
   * Trigger the server camera and resolve with the picture it produces.
   * Only one capture runs at a time, and client uploads arriving meanwhile are
   * ignored, so the caller always gets the camera's own picture.
   */
  async takePictureAndWait(): Promise<Picture> {
    if (this.pendingCapture) {
      throw new FotoboxError('A picture is already being taken.', {
        code: 'MAIN.CAMERA.BUSY',
      });
    }
    this.pendingCapture = this.captureNextPicture();
    try {
      return await this.pendingCapture;
    } finally {
      this.pendingCapture = null;
    }
  }

  private async captureNextPicture(): Promise<Picture> {
    const picturePending = firstValueFrom(
      this.cameraPicture$.pipe(timeout(TAKE_PICTURE_TIMEOUT_MS)),
    );
    // Avoid an unhandled rejection if takePicture() throws first.
    picturePending.catch(() => undefined);
    await this.takePicture();
    try {
      return await picturePending;
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new FotoboxError('Camera did not respond within 30 s', {
          code: 'MAIN.CAMERA.TIMEOUT',
        });
      }
      throw err;
    }
  }

  startLiveViewBroadcast(): void {
    if (!this.getCurrentCamera()) {
      throw new FotoboxError(
        'No camera initialized. Please initialize a camera first.',
        { code: 'MAIN.CAMERA.NOT_INITIALIZED' },
      );
    }

    this.stopLiveViewBroadcast();

    this.liveViewBroadcastSubscription = this.startLiveView().subscribe({
      next: (base64Data) => {
        const frame: LiveViewFrame = {
          data: base64Data,
          timestamp: new Date().toISOString(),
        };
        void this.pubSub.publish(LIVE_VIEW_TOPIC, { liveViewStream: frame });
      },
      error: (error) => {
        logger.error('Error in live view stream:', error);
      },
    });
  }

  stopLiveViewBroadcast(): void {
    if (this.liveViewBroadcastSubscription) {
      this.liveViewBroadcastSubscription.unsubscribe();
      this.liveViewBroadcastSubscription = null;
    }
    this.stopLiveView();
  }

  liveViewStreamIterator() {
    return this.pubSub.asyncIterableIterator(LIVE_VIEW_TOPIC);
  }

  pictureTakenIterator() {
    return this.pubSub.asyncIterableIterator(PICTURE_TAKEN_TOPIC);
  }

  private handleCapturedPicture(pictureData: string): PhotoSavedEvent {
    const photoId = createPhotoId();
    const photoBuffer = decodeJpegPicture(pictureData);

    const filePath = this.photoStorage.savePhoto(photoId, photoBuffer);
    logger.info(`Photo saved to ${filePath}`);

    const relativePath = `/api/photos/${photoId}.jpg`;

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

  async onModuleDestroy(): Promise<void> {
    this.pictureTakenServerSubscription?.unsubscribe();
    this.stopLiveViewBroadcast();
    await this.deinitializeCamera();
  }

  async takePicture(): Promise<void> {
    logger.info('Taking picture');

    if (!this.currentCamera) {
      throw new FotoboxError('Camera not initialized', {
        code: 'MAIN.CAMERA.NOT_INITIALIZED',
      });
    }

    await this.currentCamera.takePicture();
  }

  startLiveView(): Observable<string> {
    this.liveViewSubscriptionCount++;
    logger.debug(
      `Live view subscription count: ${this.liveViewSubscriptionCount}`,
    );

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

  stopLiveView(): void {
    this.liveViewSubscriptionCount = Math.max(
      0,
      this.liveViewSubscriptionCount - 1,
    );
    logger.debug(
      `Live view subscription count: ${this.liveViewSubscriptionCount}`,
    );

    if (this.liveViewSubscriptionCount <= 0) {
      this.stopLiveViewInternal();
    }
  }

  private stopLiveViewInternal(): void {
    if (this.liveViewSubscription) {
      logger.debug('Stopping live view stream from camera');
      this.liveViewSubscription.unsubscribe();
      this.liveViewSubscription = null;
    }

    const camera = this.currentCamera;
    if (camera) {
      void camera.stopLiveView().catch((error) => {
        logger.error('Error stopping camera live view:', error);
      });
    }

    this.liveViewSubscriptionCount = 0;
    this.liveViewSubject = new ReplaySubject<string>(1);
  }

  getCurrentCamera(): CameraInterface | null {
    return this.currentCamera;
  }

  getCurrentDriver(): string | null {
    return this.currentCamera?.driver ?? this.clientDriver ?? null;
  }

  getPictureTaken$(): Observable<PhotoSavedEvent> {
    if (!this.currentCamera) {
      throw new FotoboxError('Camera not initialized', {
        code: 'MAIN.CAMERA.NOT_INITIALIZED',
      });
    }
    // A single bad picture must not terminate the camera's picture stream.
    return this.currentCamera.observePictures().pipe(
      mergeMap((pictureData) => {
        try {
          return of(this.handleCapturedPicture(pictureData));
        } catch (error) {
          logger.error('Discarding picture from camera:', error);
          return EMPTY;
        }
      }),
    );
  }
}
