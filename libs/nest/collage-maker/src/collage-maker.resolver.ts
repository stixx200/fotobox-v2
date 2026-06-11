import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { CollageMakerService } from './collage-maker.service';
import {
  CollageTemplate,
  CollageStatus,
  CollageOutput,
  CreateCollageInput,
  AddPhotoInput,
} from './models/collage.model';
import { GenericMutationResult } from '@fotobox/nest-graphql';
import { getLogger } from '@fotobox/logging';
import { SettingsService } from '@fotobox/nest-settings';

const logger = getLogger('CollageMakerResolver');
const pubSub = new PubSub();

const COLLAGE_PROGRESS_TOPIC = 'collageProgress';
const COLLAGE_COMPLETE_TOPIC = 'collageComplete';

@Resolver(() => CollageTemplate)
export class CollageMakerResolver {
  constructor(
    private readonly collageMakerService: CollageMakerService,
    private readonly settingsService: SettingsService,
  ) {}

  @Query(() => [String], {
    description: 'Get list of available collage template IDs',
  })
  async availableLayoutIds(
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<string[]> {
    logger.debug('Fetching available layout IDs', { collageDirectory });

    try {
      // Use provided collageDirectory if available, otherwise read from settings
      let directory = collageDirectory;
      if (!directory) {
        const collageDirectorySetting =
          await this.settingsService.getSetting('collageDirectory');
        directory = collageDirectorySetting
          ? typeof collageDirectorySetting.value === 'string'
            ? JSON.parse(collageDirectorySetting.value)
            : collageDirectorySetting.value
          : undefined;
      }

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
  async collageTemplates(): Promise<CollageTemplate[]> {
    logger.debug('Fetching collage templates');

    // Return mock templates - in production this would read from the template directory
    return [
      {
        id: 'template-1',
        name: '2x2 Grid',
        photoCount: 4,
        description: 'Simple 2x2 photo grid',
      },
      {
        id: 'template-2',
        name: '3x3 Grid',
        photoCount: 9,
        description: 'Large 3x3 photo grid',
      },
    ];
  }

  @Query(() => CollageStatus, {
    nullable: true,
    description: 'Get current collage status',
  })
  async collageStatus(): Promise<CollageStatus | null> {
    logger.debug('Fetching collage status');

    // This would check the internal state of the collage maker
    // For now returning null to indicate no active collage
    return null;
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Start a new collage with specified template',
  })
  async startCollage(
    @Args('input') input: CreateCollageInput,
  ): Promise<GenericMutationResult> {
    logger.info(`Starting collage with template: ${input.templateId}`);

    try {
      this.collageMakerService.startCollage(input.templateId);

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
      // Use provided collageDirectory if available, otherwise read from settings
      let directory = collageDirectory;
      if (!directory) {
        const collageDirectorySetting =
          await this.settingsService.getSetting('collageDirectory');
        directory = collageDirectorySetting
          ? typeof collageDirectorySetting.value === 'string'
            ? JSON.parse(collageDirectorySetting.value)
            : collageDirectorySetting.value
          : undefined;
      }

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
