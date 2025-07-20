import { Injectable, Scope } from '@nestjs/common';
import {
  CollageMaker,
  resolveTemplate,
  TemplateInterface,
} from '@fotobox/collage-maker';
import { ConfigService } from '@nestjs/config';
import { BehaviorSubject, catchError, of, switchMap } from 'rxjs';
import { FotoboxError } from '@fotobox/error';

@Injectable({ scope: Scope.TRANSIENT })
export class CollageMakerService {
  private photoDirectory: string;
  private templateDirectory?: string;

  private cache$ = new BehaviorSubject<{
    template: TemplateInterface;
    photos: string[];
  } | null>(null);

  private collage$ = this.cache$.pipe(
    switchMap(async (cache) => {
      if (cache === null) {
        return of(Buffer.from(''));
      }
      const maker = new CollageMaker({ photoDir: this.photoDirectory });
      const output = await maker.createCollage(cache.template, cache.photos);
      return {
        data: output,
        done: maker.getPhotoCount(cache.template) >= cache.photos.length,
      };
    }),
    catchError((error) => {
      throw new FotoboxError(`Error creating collage: ${error.message}`, {
        code: 'MAIN.COLLAGE-MAKER.CREATION_ERROR',
      });
    })
  );

  constructor(private config: ConfigService) {
    this.photoDirectory = this.config.getOrThrow('photoDirectory');
    this.templateDirectory = this.config.get('templateDirectory');
  }

  public startCollage(templateId: string) {
    this.cache$.next({
      template: resolveTemplate(templateId, this.templateDirectory),
      photos: [],
    });
    return this.collage$;
  }

  public resetCollage() {
    this.cache$.next(null);
  }

  public addPhoto(photo: string) {
    if (this.cache$.value === null) {
      throw new Error(
        'Collage is not initialized. Please start a collage first.'
      );
    }

    this.cache$.next({
      ...this.cache$.value,
      photos: [...this.cache$.value.photos, photo],
    });
  }
}
