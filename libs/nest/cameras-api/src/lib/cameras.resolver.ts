import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { CameraService } from './cameras.service';
import { CameraInfo, CameraList, Picture, LiveViewFrame } from './models/camera.model';
import { GenericMutationResult } from '@fotobox/nest-graphql';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('CameraResolver');
const pubSub = new PubSub();

const LIVE_VIEW_TOPIC = 'liveView';
const PICTURE_TAKEN_TOPIC = 'pictureTaken';

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
    description: 'Initialize camera with specified driver' 
  })
  async initializeCamera(
    @Args('driver') driver: string
  ): Promise<GenericMutationResult> {
    logger.debug(`Initializing camera: ${driver}`);
    
    try {
      await this.cameraService.initializeCamera(driver);
      return {
        success: true,
        message: `Camera initialized with driver: ${driver}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Mutation(() => Picture, { description: 'Take a picture with the camera' })
  async takePicture(): Promise<Picture> {
    logger.debug('Taking picture');
    
    const pictureId = await this.cameraService.takePicture();
    const picture: Picture = {
      id: pictureId,
      path: `/photos/${pictureId}.jpg`,
      timestamp: new Date().toISOString(),
    };

    // Publish picture taken event
    pubSub.publish(PICTURE_TAKEN_TOPIC, { pictureTaken: picture });

    return picture;
  }

  @Mutation(() => GenericMutationResult, { 
    description: 'Start live view streaming' 
  })
  async startLiveView(): Promise<GenericMutationResult> {
    logger.debug('Starting live view');
    
    // Simulate live view - in production this would start the camera stream
    const interval = setInterval(() => {
      const frame: LiveViewFrame = {
        data: Buffer.from('mock-image-data').toString('base64'),
        timestamp: new Date().toISOString(),
      };
      pubSub.publish(LIVE_VIEW_TOPIC, { liveViewStream: frame });
    }, 1000);

    // Store interval for cleanup (in production this would be managed better)
    (global as any).__liveViewInterval = interval;

    return {
      success: true,
      message: 'Live view started',
    };
  }

  @Mutation(() => GenericMutationResult, { 
    description: 'Stop live view streaming' 
  })
  async stopLiveView(): Promise<GenericMutationResult> {
    logger.debug('Stopping live view');
    
    const interval = (global as any).__liveViewInterval;
    if (interval) {
      clearInterval(interval);
      delete (global as any).__liveViewInterval;
    }

    return {
      success: true,
      message: 'Live view stopped',
    };
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
