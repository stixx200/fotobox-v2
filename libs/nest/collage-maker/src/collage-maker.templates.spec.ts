import { describe, expect, it } from 'vitest';
import { CollageMakerService } from './collage-maker.service';

describe('CollageMakerService template listing', () => {
  it('returns an empty list when template directories are unavailable', () => {
    const service = Object.create(CollageMakerService.prototype) as CollageMakerService;
    Object.assign(service, {
      templateDirectory: '/path/that/does/not/exist',
      builtInDirectory: '/another/missing/path',
    });

    expect(service.listCollageTemplates('/path/that/does/not/exist')).toEqual([]);
  });
});
