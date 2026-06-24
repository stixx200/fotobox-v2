import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { CollageMakerService } from './collage-maker.service';
import {
  CollageTemplate,
  CollageStatus,
  CollageResult,
  CreateCollageInput,
  AddPhotoInput,
} from './models/collage.model';
import { GenericMutationResult } from '@fotobox/nest-graphql';
import { getLogger } from '@fotobox/logging';
import { SettingsService } from '@fotobox/nest-settings';
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';
import { Int } from '@nestjs/graphql';
import { resolveCollageDirectory } from './template-paths';

const logger = getLogger('CollageMakerResolver');
const pubSub = new PubSub();

const COLLAGE_PROGRESS_TOPIC = 'collageProgress';
const COLLAGE_COMPLETE_TOPIC = 'collageComplete';

@Resolver(() => CollageTemplate)
export class CollageMakerResolver {
  constructor(
    private readonly collageMakerService: CollageMakerService,
    private readonly settingsService: SettingsService,
    private readonly photoStorage: PhotoStorageProviderService,
  ) {}

  @Query(() => [String], {
    description: 'Get list of available collage template IDs',
  })
  async availableLayoutIds(
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<string[]> {
    logger.debug('Fetching available layout IDs', { collageDirectory });

    try {
      const directory = await resolveCollageDirectory(
        this.settingsService,
        collageDirectory,
      );

      const templateIds =
        this.collageMakerService.getAvailableTemplateIds(directory);
      return ['Einzelbild', ...templateIds];
    } catch (error) {
      logger.error('Error fetching available layouts', {
        error: error instanceof Error ? error.message : String(error),
      });
      return ['Einzelbild'];
    }
  }

  @Query(() => [CollageTemplate], {
    description: 'Get list of available collage templates',
  })
  async collageTemplates(
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<CollageTemplate[]> {
    logger.debug('Fetching collage templates', { collageDirectory });

    const directory = await resolveCollageDirectory(
      this.settingsService,
      collageDirectory,
    );

    return this.collageMakerService.listCollageTemplates(directory).map(
      (template) => ({
        id: template.id,
        name: template.id,
        photoCount: template.spaces.length,
        description: `${template.width}x${template.height}`,
      }),
    );
  }

  @Query(() => String, {
    nullable: true,
    description:
      'Render the current partial collage as a base64 JPEG (questionmarks fill empty slots)',
  })
  async collagePreview(): Promise<string | null> {
    logger.debug('Generating current collage preview');
    try {
      const buffer = await this.collageMakerService.generateCurrentPreview();
      if (!buffer) {
        return null;
      }
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
      logger.error('Failed to generate collage preview', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  @Query(() => CollageStatus, {
    nullable: true,
    description: 'Get current collage status',
  })
  async collageStatus(): Promise<CollageStatus | null> {
    logger.debug('Fetching collage status');
    return this.collageMakerService.getStatus();
  }

  @Query(() => Int, {
    description: 'Get the number of photos required for a template',
  })
  async requiredCollagePhotos(
    @Args('templateId') templateId: string,
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<number> {
    try {
      const directory = await resolveCollageDirectory(
        this.settingsService,
        collageDirectory,
      );
      return this.collageMakerService.getRequiredPhotoCount(
        templateId,
        directory,
      );
    } catch (error) {
      logger.error('Error resolving required photo count', {
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Start a new collage with specified template',
  })
  async startCollage(
    @Args('input') input: CreateCollageInput,
  ): Promise<GenericMutationResult> {
    logger.info(`Starting collage with template: ${input.templateId}`);

    try {
      const directory = await resolveCollageDirectory(this.settingsService);

      this.collageMakerService.startCollage(input.templateId, directory);

      return {
        success: true,
        message: `Collage started with template: ${input.templateId}`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start collage';
      return {
        success: false,
        message,
      };
    }
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Add a photo to the current collage',
  })
  async addPhotoToCollage(
    @Args('input') input: AddPhotoInput,
  ): Promise<GenericMutationResult> {
    logger.info(`Adding photo to collage: ${input.photoPath}`);

    try {
      this.collageMakerService.addPhoto(input.photoPath);

      // Publish progress update
      pubSub.publish(COLLAGE_PROGRESS_TOPIC, {
        collageProgress: {
          photoAdded: input.photoPath,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: 'Photo added to collage',
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to add photo to collage';
      return {
        success: false,
        message,
      };
    }
  }

  @Mutation(() => CollageResult, {
    description: 'Render and persist the current collage',
  })
  async finalizeCollage(): Promise<CollageResult> {
    logger.info('Finalizing collage');

    const buffer = await this.collageMakerService.createCurrentCollage();
    const id = `collage-${Date.now()}`;
    this.photoStorage.savePhoto(id, buffer);
    const result: CollageResult = {
      id,
      path: `/api/photos/${id}.jpg`,
      timestamp: new Date().toISOString(),
    };

    this.collageMakerService.resetCollage();

    pubSub.publish(COLLAGE_COMPLETE_TOPIC, {
      collageComplete: result,
    });

    return result;
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Reset the current collage',
  })
  async resetCollage(): Promise<GenericMutationResult> {
    logger.info('Resetting collage');

    this.collageMakerService.resetCollage();

    return {
      success: true,
      message: 'Collage has been reset',
    };
  }

  @Subscription(() => String, {
    description: 'Subscribe to collage progress updates',
  })
  collageProgress() {
    return pubSub.asyncIterableIterator(COLLAGE_PROGRESS_TOPIC);
  }

  @Subscription(() => CollageResult, {
    description: 'Subscribe to collage completion events',
  })
  collageComplete() {
    return pubSub.asyncIterableIterator(COLLAGE_COMPLETE_TOPIC);
  }

  @Query(() => String, {
    description: 'Get preview image URL for a layout template',
  })
  async layoutPreview(
    @Args('layoutId') layoutId: string,
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<string> {
    logger.debug('Generating preview for layout', {
      layoutId,
      collageDirectory,
    });

    // For Einzelbild, return a static preview path
    if (layoutId === 'Einzelbild') {
      return '/singlelayout.preview.jpg';
    }

    try {
      const directory = await resolveCollageDirectory(
        this.settingsService,
        collageDirectory,
      );

      // Generate preview image and return as base64 data URL
      const previewBuffer = await this.collageMakerService.generatePreview(
        layoutId,
        directory,
      );
      const base64Image = previewBuffer.toString('base64');
      return `data:image/jpeg;base64,${base64Image}`;
    } catch (error) {
      logger.error('Error generating layout preview', {
        layoutId,
        collageDirectory,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return fallback preview
      return '/collagelayout.preview.jpg';
    }
  }
}
