import { TemplateInterface } from '@fotobox/collage-maker';
import { BACKGROUND_FILENAME } from './constants';

export function generateIndexJs(template: TemplateInterface): string {
  const exportData: TemplateInterface = {
    ...template,
    background: BACKGROUND_FILENAME,
  };
  return `module.exports = ${JSON.stringify(exportData, null, 2)};\n`;
}
