import { Injectable, Scope } from '@nestjs/common';
import {
  CollageMaker,
  resolveTemplate,
  TemplateInterface,
  getTemplates,
} from '@fotobox/collage-maker';
import { ConfigService } from '@nestjs/config';
import { BehaviorSubject, catchError, of, switchMap } from 'rxjs';
import { FotoboxError } from '@fotobox/error';
import { getLogger } from '@fotobox/logging';
import path from 'path';

const logger = getLogger('CollageMakerService');

@Injectable({ scope: Scope.TRANSIENT })
export class CollageMakerService {
  private photoDirectory: string;
  private templateDirectory?: string;
  private builtInDirectory: string;
  private currentTemplateId?: string;
  private cache$ = new BehaviorSubject<{
    template: TemplateInterface;
    photos: string[];
  } | null>(null);

  private collage$ = this.cache$.pipe(
    switchMap(
      async (
        cache: { template: TemplateInterface; photos: string[] } | null,
      ) => {
        if (cache === null) {
          return of(Buffer.from(''));
        }
        const maker = new CollageMaker({ photoDir: this.photoDirectory });
        const output = await maker.createCollage(cache.template, cache.photos);
        return {
          data: output,
          done: maker.getPhotoCount(cache.template) >= cache.photos.length,
        };
      },
    ),
    catchError((error: Error) => {
      throw new FotoboxError(`Error creating collage: ${error.message}`, {
        code: 'MAIN.COLLAGE-MAKER.CREATION_ERROR',
      });
    }),
  );

  constructor(private config: ConfigService) {
    this.photoDirectory = this.config.getOrThrow('photoDirectory');
    this.templateDirectory = this.config.get('templateDirectory');
    this.builtInDirectory = path.join(process.cwd(), 'collage-templates');
  }

  /**
   * Get available template IDs from the configured template directory.
   * @param templateDirectory Optional override for the template directory path
   * @returns Array of template IDs
   */
  public getAvailableTemplateIds(userTemplateDirectory?: string): string[] {
    const dir = userTemplateDirectory || this.templateDirectory;

    try {
      const templates = getTemplates(dir, this.builtInDirectory);
      return Object.keys(templates);
    } catch (error) {
      logger.error('Error loading templates', {
        userDirectory: dir,
        builtInDirectory: this.builtInDirectory,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public startCollage(templateId: string, userTemplateDirectory?: string) {
    const dir = userTemplateDirectory || this.templateDirectory;
    this.currentTemplateId = templateId;
    this.cache$.next({
      template: resolveTemplate(templateId, dir, this.builtInDirectory),
      photos: [],
    });
    return this.collage$;
  }

  public resetCollage() {
    this.currentTemplateId = undefined;
    this.cache$.next(null);
  }

  public addPhoto(photo: string) {
    if (this.cache$.value === null) {
      throw new Error(
        'Collage is not initialized. Please start a collage first.',
      );
    }

    this.cache$.next({
      ...this.cache$.value,
      photos: [...this.cache$.value.photos, photo],
    });
  }

  /**
   * Get the number of photos a template requires.
   */
  public getRequiredPhotoCount(
    templateId: string,
    userTemplateDirectory?: string,
  ): number {
    const dir = userTemplateDirectory || this.templateDirectory;
    const template = resolveTemplate(templateId, dir, this.builtInDirectory);
    const maker = new CollageMaker({ photoDir: this.photoDirectory });
    return maker.getPhotoCount(template);
  }

  /**
   * Number of photos collected so far for the in-progress collage.
   */
  public getCurrentPhotoCount(): number {
    return this.cache$.value?.photos.length ?? 0;
  }

  /**
   * Whether the in-progress collage has collected all required photos.
   */
  public isComplete(): boolean {
    const cache = this.cache$.value;
    if (cache === null) {
      return false;
    }
    const maker = new CollageMaker({ photoDir: this.photoDirectory });
    return cache.photos.length >= maker.getPhotoCount(cache.template);
  }

  /**
   * Render the in-progress collage into a final image buffer.
   */
  public async createCurrentCollage(): Promise<Buffer> {
    const cache = this.cache$.value;
    if (cache === null) {
      throw new FotoboxError('No collage in progress to finalize.', {
        code: 'MAIN.COLLAGE-MAKER.NOT_INITIALIZED',
      });
    }
    const maker = new CollageMaker({ photoDir: this.photoDirectory });
    return maker.createCollage(cache.template, cache.photos);
  }

  /**
   * Current collage status snapshot.
   */
  public getStatus(): {
    templateId: string;
    photoCount: number;
    requiredPhotoCount: number;
    complete: boolean;
    photos: string[];
  } | null {
    const cache = this.cache$.value;
    if (cache === null || this.currentTemplateId === undefined) {
      return null;
    }
    const maker = new CollageMaker({ photoDir: this.photoDirectory });
    const requiredPhotoCount = maker.getPhotoCount(cache.template);
    return {
      templateId: this.currentTemplateId,
      photoCount: cache.photos.length,
      requiredPhotoCount,
      complete: cache.photos.length >= requiredPhotoCount,
      photos: cache.photos,
    };
  }

  /**
   * Generate a preview image for a template using default placeholder photos.
   * @param templateId The template ID to generate a preview for
   * @param templateDirectory Optional override for the template directory path
   * @returns Buffer containing the preview image
   */
  public async generatePreview(
    templateId: string,
    userTemplateDirectory?: string,
  ): Promise<Buffer> {
    const dir = userTemplateDirectory || this.templateDirectory;
    const template = resolveTemplate(templateId, dir, this.builtInDirectory);
    const maker = new CollageMaker({ photoDir: this.photoDirectory });

    // Generate collage with empty photos array - will use questionmark placeholders
    const preview = await maker.createCollage(template, []);
    return preview;
  }
}
