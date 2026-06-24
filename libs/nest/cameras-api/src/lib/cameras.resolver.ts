import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
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
import { FotoboxError } from '@fotobox/error';

const logger = getLogger('CameraResolver');

@Resolver(() => CameraInfo)
export class CameraResolver {
  constructor(private readonly cameraService: CameraService) {}

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
      this.cameraService.startPictureTakenBroadcast(driver);
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
    return this.cameraService.takePictureAndWait();
  }

  @Mutation(() => Picture, {
    description:
      'Upload a photo captured by a client camera (e.g. the browser webcam).',
  })
  async uploadPhoto(@Args('input') input: UploadPhotoInput): Promise<Picture> {
    logger.debug('Receiving uploaded photo from client');
    return this.cameraService.uploadAndBroadcastPhoto(input.imageData);
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Start live view streaming',
  })
  async startLiveView(): Promise<GenericMutationResult> {
    logger.debug('Starting live view');

    try {
      this.cameraService.startLiveViewBroadcast();
      return {
        success: true,
        message: 'Live view started',
      };
    } catch (error) {
      if (error instanceof FotoboxError) {
        return {
          success: false,
          message: error.message,
        };
      }
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
      this.cameraService.stopLiveViewBroadcast();
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
    return this.cameraService.liveViewStreamIterator();
  }

  @Subscription(() => Picture, {
    description: 'Subscribe to picture taken events',
  })
  pictureTaken() {
    return this.cameraService.pictureTakenIterator();
  }
}
