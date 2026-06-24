import { describe, expect, it } from 'vitest';
import { CollageMaker } from './collage-maker';
import type { TemplateInterface } from './template.interface';

const template: TemplateInterface = {
  id: 'test-template',
  width: 800,
  height: 600,
  spaces: [
    {
      type: 'photo',
      x: 10,
      y: 20,
      width: 200,
      height: 150,
    },
    {
      type: 'photo',
      x: 220,
      y: 20,
      width: 200,
      height: 150,
    },
  ],
};

describe('CollageMaker', () => {
  it('reports the number of photo slots in a template', () => {
    const maker = new CollageMaker({ photoDir: '/tmp' });
    expect(maker.getPhotoCount(template)).toBe(2);
  });
});
