import { calculateWidthHeight } from './helper';
import { Border, Space, TemplateInterface } from './template.interface';

export class TemplateLoader {
  constructor(private template: TemplateInterface) {}

  getBackground() {
    return this.template.background;
  }

  getPhotoSizes(): {
    contentSize: { width: number; height: number };
    border?: Border;
  } {
    const { width, height } = calculateWidthHeight(
      this.template.width,
      this.template.height,
      this.template.border
    );
    return {
      contentSize: {
        width,
        height,
      },
      border: this.template.border,
    };
  }

  getComposites(): Space[] {
    return this.template.spaces.filter((space) => space.type === 'photo');
  }
}
