import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { firstValueFrom, of } from 'rxjs';
import { SettingsService } from './settings.service';

describe('SettingsService.updateSettings', () => {
  function create(result: unknown): SettingsService {
    TestBed.configureTestingModule({
      providers: [{ provide: Apollo, useValue: { mutate: () => of(result) } }],
    });
    return TestBed.inject(SettingsService);
  }

  it('returns the saved settings', async () => {
    const saved = [{ key: 'shutterTimeout', value: '3' }];
    const service = create({ data: { updateSettings: saved } });
    await expect(
      firstValueFrom(
        service.updateSettings([{ key: 'shutterTimeout', value: '3' }]),
      ),
    ).resolves.toEqual(saved);
  });

  it('fails instead of returning null when the server reports an error', async () => {
    const service = create({
      data: { updateSettings: null },
      error: new Error('Validation failed'),
    });
    await expect(
      firstValueFrom(
        service.updateSettings([{ key: 'shutterTimeout', value: 'x' }]),
      ),
    ).rejects.toThrow('Validation failed');
  });

  it('fails when the response has no settings list', async () => {
    const service = create({ data: { updateSettings: null } });
    await expect(firstValueFrom(service.updateSettings([]))).rejects.toThrow(
      'Settings were not saved',
    );
  });
});
