import { Test, TestingModule } from '@nestjs/testing';
import { CollageMakerService } from './collage-maker.service';

describe('CollageMakerService', () => {
  let service: CollageMakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollageMakerService],
    }).compile();

    service = module.get<CollageMakerService>(CollageMakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
