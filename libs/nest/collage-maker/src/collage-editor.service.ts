import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  CollageEditorProject,
  CollageEditorProjectSummary,
  generateIndexJs,
  projectToTemplate,
  SIDECAR_FILENAME,
  BACKGROUND_FILENAME,
  INDEX_JS_FILENAME,
  ASSETS_DIR,
  templateToPartialProject,
  COLLAGE_EDITOR_VERSION,
} from '@fotobox/collage-editor';
import {
  CollageMaker,
  getTemplates,
  previewPhotoNamesForSlots,
  resolveCollageMakerImagesDirectory,
  resolveTemplate,
} from '@fotobox/collage-maker';
import { FotoboxError } from '@fotobox/error';
import { getLogger } from '@fotobox/logging';
import { resolveBuiltInTemplateDirectory } from './template-paths';

const logger = getLogger('CollageEditorService');

declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire: NodeRequire =
  typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__
    : createRequire(import.meta.url);

export interface SaveProjectPayload {
  project: CollageEditorProject;
  backgroundBase64: string;
  assets?: { filename: string; base64: string }[];
  overwrite?: boolean;
}

@Injectable()
export class CollageEditorService {
  private builtInDirectory: string;

  constructor(private config: ConfigService) {
    this.builtInDirectory = resolveBuiltInTemplateDirectory(this.config);
  }

  resolveTemplateDirectory(userDirectory?: string): string | undefined {
    return userDirectory || this.config.get('templateDirectory');
  }

  listProjects(userDirectory?: string): CollageEditorProjectSummary[] {
    const directory = this.resolveTemplateDirectory(userDirectory);
    if (!directory || !fs.existsSync(directory)) {
      return [];
    }

    const summaries: CollageEditorProjectSummary[] = [];
    for (const entry of fs.readdirSync(directory)) {
      const folder = path.join(directory, entry);
      if (!fs.statSync(folder).isDirectory()) {
        continue;
      }
      const sidecarPath = path.join(folder, SIDECAR_FILENAME);
      if (!fs.existsSync(sidecarPath)) {
        continue;
      }
      try {
        const project = JSON.parse(
          fs.readFileSync(sidecarPath, 'utf8'),
        ) as CollageEditorProject;
        summaries.push({
          id: project.id,
          name: project.name,
          width: project.width,
          height: project.height,
          updatedAt: fs.statSync(sidecarPath).mtime.toISOString(),
          thumbnailBase64: this.readThumbnail(folder),
        });
      } catch (error) {
        logger.warn('Failed to read editor sidecar', {
          folder,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return summaries.sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    );
  }

  loadProject(
    templateId: string,
    userDirectory?: string,
  ): CollageEditorProject {
    const directory = this.resolveTemplateDirectory(userDirectory);
    if (!directory) {
      throw new FotoboxError('No collage directory configured.', {
        code: 'MAIN.COLLAGE-EDITOR.NO_DIRECTORY',
      });
    }
    const sidecarPath = path.join(directory, templateId, SIDECAR_FILENAME);
    if (fs.existsSync(sidecarPath)) {
      return JSON.parse(
        fs.readFileSync(sidecarPath, 'utf8'),
      ) as CollageEditorProject;
    }
    return this.importLegacyTemplate(templateId, directory);
  }

  private importLegacyTemplate(
    templateId: string,
    userDirectory: string,
  ): CollageEditorProject {
    const template = resolveTemplate(
      templateId,
      userDirectory,
      this.builtInDirectory,
    );
    const folder = path.join(userDirectory, templateId);
    const backgroundCandidates = [
      template.background,
      path.join(folder, BACKGROUND_FILENAME),
    ].filter((p): p is string => !!p);

    let backgroundDataUrl: string | undefined;
    for (const candidate of backgroundCandidates) {
      const backgroundPath = path.isAbsolute(candidate)
        ? candidate
        : path.join(folder, path.basename(candidate));
      if (fs.existsSync(backgroundPath)) {
        const buffer = fs.readFileSync(backgroundPath);
        backgroundDataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        break;
      }
    }

    return templateToPartialProject(template, {
      name: templateId,
      backgroundDataUrl,
    });
  }

  saveProject(
    userDirectory: string | undefined,
    payload: SaveProjectPayload,
  ): { templateId: string; path: string } {
    const directory = this.resolveTemplateDirectory(userDirectory);
    if (!directory) {
      throw new FotoboxError('No collage directory configured.', {
        code: 'MAIN.COLLAGE-EDITOR.NO_DIRECTORY',
      });
    }

    const { project, backgroundBase64, assets = [], overwrite = false } =
      payload;
    if (project.version !== COLLAGE_EDITOR_VERSION) {
      throw new FotoboxError(
        `Unsupported editor project version: ${project.version}`,
        { code: 'MAIN.COLLAGE-EDITOR.UNSUPPORTED_VERSION' },
      );
    }

    const templateFolder = path.join(directory, project.id);
    if (fs.existsSync(templateFolder) && !overwrite) {
      throw new FotoboxError(
        `Template '${project.id}' already exists. Pass overwrite to replace it.`,
        { code: 'MAIN.COLLAGE-EDITOR.ALREADY_EXISTS', info: { id: project.id } },
      );
    }

    fs.mkdirSync(templateFolder, { recursive: true });
    const assetsFolder = path.join(templateFolder, ASSETS_DIR);
    fs.mkdirSync(assetsFolder, { recursive: true });

    for (const asset of assets) {
      const safeName = path.basename(asset.filename);
      fs.writeFileSync(
        path.join(assetsFolder, safeName),
        Buffer.from(asset.base64, 'base64'),
      );
    }

    const backgroundBuffer = this.decodeBase64Image(backgroundBase64);
    fs.writeFileSync(
      path.join(templateFolder, BACKGROUND_FILENAME),
      backgroundBuffer,
    );

    const template = projectToTemplate(project);
    fs.writeFileSync(
      path.join(templateFolder, INDEX_JS_FILENAME),
      generateIndexJs(template),
    );
    fs.writeFileSync(
      path.join(templateFolder, SIDECAR_FILENAME),
      JSON.stringify(project, null, 2),
    );

    logger.info('Saved collage editor project', {
      templateId: project.id,
      folder: templateFolder,
    });

    return { templateId: project.id, path: templateFolder };
  }

  async validateTemplate(
    templateId: string,
    userDirectory?: string,
  ): Promise<{ valid: boolean; previewBase64?: string; message?: string }> {
    try {
      const directory = this.resolveTemplateDirectory(userDirectory);
      const template = resolveTemplate(
        templateId,
        directory,
        this.builtInDirectory,
      );
      const previewPhotoDir = resolveCollageMakerImagesDirectory();
      const maker = new CollageMaker({ photoDir: previewPhotoDir });
      const previewPhotos = previewPhotoNamesForSlots(
        maker.getPhotoCount(template),
      );
      const buffer = await maker.createCollage(template, previewPhotos);
      return {
        valid: true,
        previewBase64: buffer.toString('base64'),
      };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  listLegacyTemplates(userDirectory?: string): string[] {
    const directory = this.resolveTemplateDirectory(userDirectory);
    if (!directory || !fs.existsSync(directory)) {
      return [];
    }

    const templates = getTemplates(directory, this.builtInDirectory);
    return Object.keys(templates).filter((id) => {
      const sidecarPath = path.join(directory, id, SIDECAR_FILENAME);
      return !fs.existsSync(sidecarPath);
    });
  }

  deleteProject(
    templateId: string,
    userDirectory?: string,
  ): { templateId: string } {
    const directory = this.resolveTemplateDirectory(userDirectory);
    if (!directory) {
      throw new FotoboxError('No collage directory configured.', {
        code: 'MAIN.COLLAGE-EDITOR.NO_DIRECTORY',
      });
    }
    const templateFolder = path.join(directory, templateId);
    if (!fs.existsSync(templateFolder)) {
      throw new FotoboxError(`Template '${templateId}' not found.`, {
        code: 'MAIN.COLLAGE-EDITOR.NOT_FOUND',
      });
    }
    fs.rmSync(templateFolder, { recursive: true, force: true });
    logger.info('Deleted collage editor project', {
      templateId,
      folder: templateFolder,
    });
    return { templateId };
  }

  duplicateProject(
    sourceId: string,
    newId: string,
    userDirectory?: string,
  ): CollageEditorProject {
    const directory = this.resolveTemplateDirectory(userDirectory);
    if (!directory) {
      throw new FotoboxError('No collage directory configured.', {
        code: 'MAIN.COLLAGE-EDITOR.NO_DIRECTORY',
      });
    }
    const sourceFolder = path.join(directory, sourceId);
    const targetFolder = path.join(directory, newId);
    if (!fs.existsSync(sourceFolder)) {
      throw new FotoboxError(`Template '${sourceId}' not found.`, {
        code: 'MAIN.COLLAGE-EDITOR.NOT_FOUND',
      });
    }
    if (fs.existsSync(targetFolder)) {
      throw new FotoboxError(`Template '${newId}' already exists.`, {
        code: 'MAIN.COLLAGE-EDITOR.ALREADY_EXISTS',
      });
    }
    fs.cpSync(sourceFolder, targetFolder, { recursive: true });
    const sidecarPath = path.join(targetFolder, SIDECAR_FILENAME);
    if (fs.existsSync(sidecarPath)) {
      const project = JSON.parse(
        fs.readFileSync(sidecarPath, 'utf8'),
      ) as CollageEditorProject;
      project.id = newId;
      project.name = project.name ? `${project.name} copy` : newId;
      fs.writeFileSync(sidecarPath, JSON.stringify(project, null, 2));
      const indexPath = path.join(targetFolder, INDEX_JS_FILENAME);
      if (fs.existsSync(indexPath)) {
        const template = projectToTemplate(project);
        fs.writeFileSync(indexPath, generateIndexJs(template));
      }
      return project;
    }
    return this.loadProject(newId, directory);
  }

  private readThumbnail(folder: string): string | undefined {
    const backgroundPath = path.join(folder, BACKGROUND_FILENAME);
    if (!fs.existsSync(backgroundPath)) {
      return undefined;
    }
    const stat = fs.statSync(backgroundPath);
    if (stat.size > 512_000) {
      return undefined;
    }
    return fs.readFileSync(backgroundPath).toString('base64');
  }

  private decodeBase64Image(data: string): Buffer {
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }
}
