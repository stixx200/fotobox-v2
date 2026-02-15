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

const logger = getLogger('CollageMakerResolver');
const pubSub = new PubSub();

const COLLAGE_PROGRESS_TOPIC = 'collageProgress';
const COLLAGE_COMPLETE_TOPIC = 'collageComplete';

@Resolver(() => CollageTemplate)
export class CollageMakerResolver {
  constructor(private readonly collageMakerService: CollageMakerService) {}

  @Query(() => [CollageTemplate], { 
    description: 'Get list of available collage templates' 
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
    description: 'Get current collage status' 
  })
  async collageStatus(): Promise<CollageStatus | null> {
    logger.debug('Fetching collage status');
    
    // This would check the internal state of the collage maker
    // For now returning null to indicate no active collage
    return null;
  }

  @Mutation(() => GenericMutationResult, { 
    description: 'Start a new collage with specified template' 
  })
  async startCollage(
    @Args('input') input: CreateCollageInput
  ): Promise<GenericMutationResult> {
    logger.info(`Starting collage with template: ${input.templateId}`);
    
    try {
      this.collageMakerService.startCollage(input.templateId);
      
      return {
        success: true,
        message: `Collage started with template: ${input.templateId}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start collage';
      return {
        success: false,
        message,
      };
    }
  }

  @Mutation(() => GenericMutationResult, { 
    description: 'Add a photo to the current collage' 
  })
  async addPhotoToCollage(
    @Args('input') input: AddPhotoInput
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
      const message = error instanceof Error ? error.message : 'Failed to add photo to collage';
      return {
        success: false,
        message,
      };
    }
  }

  @Mutation(() => GenericMutationResult, { 
    description: 'Reset the current collage' 
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
}
