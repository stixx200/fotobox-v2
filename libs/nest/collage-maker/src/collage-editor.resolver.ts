import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CollageEditorService } from './collage-editor.service';
import {
  CollageEditorProjectModel,
  CollageEditorProjectSummaryModel,
  CollageEditorValidationResult,
  DeleteCollageEditorProjectResult,
  DuplicateCollageEditorProjectResult,
  SaveCollageEditorProjectInput,
  SaveCollageEditorProjectResult,
} from './models/collage-editor.model';
import { SettingsService } from '@fotobox/nest-settings';
import { CollageEditorProject } from '@fotobox/collage-editor';
import { getLogger } from '@fotobox/logging';
import { FotoboxError } from '@fotobox/error';
import { resolveCollageDirectory } from './template-paths';

const logger = getLogger('CollageEditorResolver');

@Resolver()
export class CollageEditorResolver {
  constructor(
    private readonly collageEditorService: CollageEditorService,
    private readonly settingsService: SettingsService,
  ) {}

  private resolveCollageDirectory(
    collageDirectory?: string,
  ): Promise<string | undefined> {
    return resolveCollageDirectory(this.settingsService, collageDirectory);
  }

  @Query(() => [CollageEditorProjectSummaryModel], {
    description: 'List collage templates with editor sidecar files',
  })
  async collageEditorProjects(
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<CollageEditorProjectSummaryModel[]> {
    const directory = await this.resolveCollageDirectory(collageDirectory);
    return this.collageEditorService.listProjects(directory);
  }

  @Query(() => [String], {
    description: 'List template folder names (including legacy without sidecar)',
  })
  async collageEditorLegacyTemplates(
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<string[]> {
    const directory = await this.resolveCollageDirectory(collageDirectory);
    return this.collageEditorService.listLegacyTemplates(directory);
  }

  @Query(() => CollageEditorProjectModel, {
    description: 'Load a collage editor project (sidecar or legacy import)',
  })
  async collageEditorProject(
    @Args('templateId') templateId: string,
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<CollageEditorProjectModel> {
    const directory = await this.resolveCollageDirectory(collageDirectory);
    const project = this.collageEditorService.loadProject(templateId, directory);
    return this.toGraphqlProject(project);
  }

  @Query(() => CollageEditorValidationResult, {
    description:
      'Validate a saved template by rendering a preview collage with example photos',
  })
  async validateCollageTemplate(
    @Args('templateId') templateId: string,
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<CollageEditorValidationResult> {
    const directory = await this.resolveCollageDirectory(collageDirectory);
    return this.collageEditorService.validateTemplate(templateId, directory);
  }

  @Mutation(() => SaveCollageEditorProjectResult, {
    description: 'Save collage editor project to the template directory',
  })
  async saveCollageEditorProject(
    @Args('input') input: SaveCollageEditorProjectInput,
  ): Promise<SaveCollageEditorProjectResult> {
    logger.info('Saving collage editor project');
    try {
      const directory = await this.resolveCollageDirectory(
        input.collageDirectory,
      );
      const project = JSON.parse(input.projectJson) as CollageEditorProject;
      return this.collageEditorService.saveProject(directory, {
        project,
        backgroundBase64: input.backgroundBase64,
        assets: input.assets,
        overwrite: input.overwrite ?? false,
      });
    } catch (error) {
      if (error instanceof FotoboxError) {
        throw error;
      }
      throw new FotoboxError(
        error instanceof Error ? error.message : 'Failed to save project',
        { code: 'MAIN.COLLAGE-EDITOR.SAVE_FAILED' },
      );
    }
  }

  @Mutation(() => DeleteCollageEditorProjectResult)
  async deleteCollageEditorProject(
    @Args('templateId') templateId: string,
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<DeleteCollageEditorProjectResult> {
    const directory = await this.resolveCollageDirectory(collageDirectory);
    return this.collageEditorService.deleteProject(templateId, directory);
  }

  @Mutation(() => DuplicateCollageEditorProjectResult)
  async duplicateCollageEditorProject(
    @Args('templateId') templateId: string,
    @Args('newTemplateId') newTemplateId: string,
    @Args('collageDirectory', { nullable: true }) collageDirectory?: string,
  ): Promise<DuplicateCollageEditorProjectResult> {
    const directory = await this.resolveCollageDirectory(collageDirectory);
    const project = this.collageEditorService.duplicateProject(
      templateId,
      newTemplateId,
      directory,
    );
    return {
      templateId: project.id,
      name: project.name ?? project.id,
    };
  }

  private toGraphqlProject(
    project: CollageEditorProject,
  ): CollageEditorProjectModel {
    return {
      version: project.version,
      id: project.id,
      name: project.name,
      width: project.width,
      height: project.height,
      borderJson: project.border ? JSON.stringify(project.border) : undefined,
      fabricJson: JSON.stringify(project.fabricJson),
      layerMetaJson: JSON.stringify(project.layerMeta ?? []),
    };
  }
}
