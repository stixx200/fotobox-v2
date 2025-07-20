import sharp from 'sharp';
import path from 'path';
import { CollageMakerConfiguration } from './collage-maker-configuration.interface';
import { calculateWidthHeight } from './helper';
import { TemplateLoader } from './template-loader';
import { Space, TemplateInterface } from './template.interface';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('collage-maker.maker');

const questionmarkPhoto = path.resolve(__dirname, '../images/questionmark.png');
const defaultBackgroundPhoto = path.resolve(
  __dirname,
  '../images/default-background.jpg'
);

function convertPhotoPath(photoPath: string) {
  return photoPath.replace('app.asar', 'app.asar.unpacked');
}

logger.info(
  `Paths to questionmark and background: ${questionmarkPhoto}, ${defaultBackgroundPhoto}`
);

async function createComposite(photoToAdd: string, space: Space) {
  const { width, height } = calculateWidthHeight(
    space.width,
    space.height,
    space.border
  );
  let input: sharp.Sharp | Buffer = sharp(convertPhotoPath(photoToAdd))
    .png()
    .resize(width, height, { fit: 'inside' });
  if (space.border) {
    input = input.extend(space.border);
  }
  input = await input.toBuffer();

  if (space.rotation) {
    input = await sharp(input)
      .rotate(space.rotation, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
    input = await sharp(input)
      .resize(width, height, { fit: 'inside' })
      .toBuffer();
  }
  return {
    input,
    top: space.y,
    left: space.x,
  };
}

export class CollageMaker {
  constructor(private configuration: CollageMakerConfiguration) {}

  getPhotoCount(template: TemplateInterface): number {
    return new TemplateLoader(template).getComposites().length;
  }

  /**
   * Creates a new collage and returns the buffer.
   * @param template The template used to create the collage.
   * @param photos List of photos. According to the template, the max. length of the array is given.
   */
  async createCollage(template: TemplateInterface, photos: string[] = []) {
    const templateLoader = new TemplateLoader(template);

    // create overlay photos
    const composites = await this.createComposites(templateLoader, photos);

    const { contentSize, border } = templateLoader.getPhotoSizes();
    try {
      let sharpInstance = sharp(
        convertPhotoPath(
          templateLoader.getBackground() || defaultBackgroundPhoto
        )
      ).resize(contentSize);
      if (border) {
        sharpInstance = sharpInstance.extend(border);
      }
      return await sharpInstance.composite(composites).jpeg().toBuffer();
    } catch (error: unknown) {
      throw new Error(`Failed to create collage: ${(error as Error).message}`);
    }
  }

  private createComposites(templateLoader: TemplateLoader, photos: string[]) {
    return Promise.all(
      templateLoader
        .getComposites()
        .map(async (space: Space, index: number) => {
          const photoToAdd = photos[index]
            ? path.join(this.configuration.photoDir, photos[index])
            : questionmarkPhoto;
          try {
            return createComposite(photoToAdd, space);
          } catch (error: unknown) {
            throw new Error(
              `Can't add ${photoToAdd}: ${(error as Error).message}`
            );
          }
        })
    );
  }
}
