import { describe, it, expect, beforeEach } from 'vitest';
import { CollageMakerService } from './collage-maker.service';

describe('CollageMakerService', () => {
  let service: CollageMakerService;

  beforeEach(() => {
    const mockConfigService = {
      getOrThrow: (key: string) => {
        if (key === 'photoDirectory') return '/tmp/photos';
        throw new Error(`Config key ${key} not found`);
      },
      get: (key: string) => {
        if (key === 'templateDirectory') return '/tmp/templates';
        return undefined;
      },
    };

    service = new CollageMakerService(mockConfigService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
