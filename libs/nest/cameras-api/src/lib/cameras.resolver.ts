import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { OnModuleDestroy } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { WEBCAM_DRIVER } from '@fotobox/cameras';
import { CameraService } from './cameras.service';
import {
  CameraInfo,
  CameraList,
  Picture,
  LiveViewFrame,
  UploadPhotoInput,
} from './models/camera.model';
import { GenericMutationResult } from '@fotobox/nest-graphql';
import { getLogger } from '@fotobox/logging';
import {
  firstValueFrom,
  Subject,
  Subscription as RxSubscription,
  timeout,
  TimeoutError,
} from 'rxjs';

const logger = getLogger('CameraResolver');
const pubSub = new PubSub();

const LIVE_VIEW_TOPIC = 'liveView';
const PICTURE_TAKEN_TOPIC = 'pictureTaken';

@Resolver(() => CameraInfo)
export class CameraResolver implements OnModuleDestroy {
  private pictureTakenSubscription: RxSubscription | null = null;
  private liveViewSubscription: RxSubscription | null = null;
  /** Emits each time a picture has been saved; used to resolve takePicture mutations. */
  private readonly pictureReady$ = new Subject<Picture>();

  constructor(private readonly cameraService: CameraService) {}

  /**
   * Cleanup subscription on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    this.pictureTakenSubscription?.unsubscribe();
    this.pictureTakenSubscription = null;

    if (this.liveViewSubscription) {
      this.liveViewSubscription.unsubscribe();
      this.liveViewSubscription = null;
      // Decrement the reference count
      this.cameraService.stopLiveView();
    }
  }

  @Query(() => CameraList, { description: 'Get list of available cameras' })
  async availableCameras(): Promise<CameraList> {
    logger.debug('Fetching available cameras');
    const cameras = await this.cameraService.getAvailableCameras();
    return { cameras };
  }

  @Query(() => CameraInfo, { description: 'Get current camera status' })
  async cameraStatus(): Promise<CameraInfo> {
    logger.debug('Fetching camera status');
    return this.cameraService.getCameraStatus();
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Initialize camera with specified driver',
  })
  async initializeCamera(
    @Args('driver') driver: string,
  ): Promise<GenericMutationResult> {
    logger.debug(`Initializing camera: ${driver}`);

    try {
      await this.cameraService.initializeCamera(driver);

      // Stop any previous server picture subscription.
      this.pictureTakenSubscription?.unsubscribe();
      this.pictureTakenSubscription = null;

      // The webcam (client) camera uploads photos via uploadPhoto; there is no
      // server-side picture stream to subscribe to.
      if (driver.toLowerCase() !== WEBCAM_DRIVER) {
        this.pictureTakenSubscription = this.cameraService
          .getPictureTaken$()
          .subscribe((pictureData) => {
            const picture: Picture = {
              id: pictureData.photoId,
              timestamp: pictureData.timestamp,
              path: pictureData.path,
            };
            this.pictureReady$.next(picture);
            pubSub.publish(PICTURE_TAKEN_TOPIC, { pictureTaken: picture });
          });
      }
      return {
        success: true,
        message: `Camera initialized with driver: ${driver}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Mutation(() => Picture, {
    description: 'Take a picture with the camera',
  })
  async takePicture(): Promise<Picture> {
    logger.debug('Taking picture');

    // Subscribe to the next picture BEFORE triggering the shutter so the
    // event is never missed, even for synchronous cameras.
    const picturePending = firstValueFrom(
      this.pictureReady$.pipe(timeout(30_000)),
    );
    await this.cameraService.takePicture();
    try {
      return await picturePending;
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error('Camera did not respond within 30 s');
      }
      throw err;
    }
  }

  @Mutation(() => Picture, {
    description:
      'Upload a photo captured by a client camera (e.g. the browser webcam).',
  })
  async uploadPhoto(@Args('input') input: UploadPhotoInput): Promise<Picture> {
    logger.debug('Receiving uploaded photo from client');

    const saved = this.cameraService.savePhoto(input.imageData);
    const picture: Picture = {
      id: saved.photoId,
      timestamp: saved.timestamp,
      path: saved.path,
    };

    // Broadcast so subscribers react uniformly regardless of camera source.
    pubSub.publish(PICTURE_TAKEN_TOPIC, { pictureTaken: picture });

    return picture;
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Start live view streaming',
  })
  async startLiveView(): Promise<GenericMutationResult> {
    logger.debug('Starting live view');

    try {
      const camera = this.cameraService.getCurrentCamera();
      if (!camera) {
        return {
          success: false,
          message: 'No camera initialized. Please initialize a camera first.',
        };
      }

      // Stop any existing live view subscription and balance the service ref count.
      if (this.liveViewSubscription) {
        this.liveViewSubscription.unsubscribe();
        this.liveViewSubscription = null;
        this.cameraService.stopLiveView();
      }

      // Subscribe to camera's live view through the service (with reference counting)
      this.liveViewSubscription = this.cameraService.startLiveView().subscribe({
        next: (base64Data) => {
          const frame: LiveViewFrame = {
            data: base64Data,
            timestamp: new Date().toISOString(),
          };
          pubSub.publish(LIVE_VIEW_TOPIC, { liveViewStream: frame });
        },
        error: (error) => {
          logger.error('Error in live view stream:', error);
        },
      });

      return {
        success: true,
        message: 'Live view started',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to start live view:', errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Stop live view streaming',
  })
  async stopLiveView(): Promise<GenericMutationResult> {
    logger.debug('Stopping live view');

    try {
      // Unsubscribe from live view
      if (this.liveViewSubscription) {
        this.liveViewSubscription.unsubscribe();
        this.liveViewSubscription = null;
      }

      // Stop live view on service (with reference counting)
      this.cameraService.stopLiveView();

      return {
        success: true,
        message: 'Live view stopped',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to stop live view:', errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Subscription(() => LiveViewFrame, {
    description: 'Subscribe to live view frames from the camera',
  })
  liveViewStream() {
    return pubSub.asyncIterableIterator(LIVE_VIEW_TOPIC);
  }

  @Subscription(() => Picture, {
    description: 'Subscribe to picture taken events',
  })
  pictureTaken() {
    return pubSub.asyncIterableIterator(PICTURE_TAKEN_TOPIC);
  }
}
