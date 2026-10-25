import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { CameraStore } from '../store';
import { ClientLogService } from './client-log.service';
import {
  FotoboxStartService,
  resolveStartConfig,
  savedStartConfig,
} from './fotobox-start.service';
import { LayoutNavigationService } from './layout-navigation.service';
import { Setting } from './settings.service';

function setting(key: string, value: unknown): Setting {
  return { key, value: JSON.stringify(value) };
}

describe('resolveStartConfig', () => {
  it('uses the given camera and layouts', () => {
    expect(
      resolveStartConfig({ camera: 'sony', layouts: ['2x2', 'Strip'] }),
    ).toEqual({ camera: 'sony', layouts: ['2x2', 'Strip'] });
  });

  it('falls back to the demo camera and the single picture', () => {
    expect(resolveStartConfig({ camera: '', layouts: [] })).toEqual({
      camera: 'demo',
      layouts: ['Einzelbild'],
    });
  });

  it('refuses malformed PINs', () => {
    expect(resolveStartConfig({ galleryPassword: '12' })).toBeNull();
    expect(resolveStartConfig({ operatorPin: '12a4' })).toBeNull();
    expect(
      resolveStartConfig({ galleryPassword: '1234', operatorPin: '' }),
    ).not.toBeNull();
  });
});

describe('savedStartConfig', () => {
  it('is null before anything was saved', () => {
    expect(savedStartConfig([])).toBeNull();
  });

  it('reads the saved settings', () => {
    expect(
      savedStartConfig([
        setting('camera', 'demo'),
        setting('layouts', ['2x2']),
        setting('operatorPin', '4711'),
      ]),
    ).toEqual({ camera: 'demo', layouts: ['2x2'] });
  });

  it('is null when a saved PIN is malformed', () => {
    expect(
      savedStartConfig([
        setting('camera', 'demo'),
        setting('operatorPin', '1'),
      ]),
    ).toBeNull();
  });
});

describe('FotoboxStartService', () => {
  const currentCamera = signal<{ driver: string; available: boolean } | null>(
    null,
  );
  const isLoading = signal(false);
  const error = signal<string | null>(null);
  const cameraStore = {
    currentCamera,
    isLiveViewActive: signal(false),
    camera$: signal({ currentCamera: null, isLoading: false, error: null }),
    initializeCamera: vi.fn(),
    startLiveView: vi.fn(),
  };
  const navigation = {
    navigateToLayout: vi.fn(() => Promise.resolve(true)),
    navigateToEntryPoint: vi.fn(() => Promise.resolve(true)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentCamera.set(null);
    isLoading.set(false);
    error.set(null);
    cameraStore.camera$ = signal({
      currentCamera: null,
      isLoading: false,
      error: null,
    });
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CameraStore, useValue: cameraStore },
        { provide: LayoutNavigationService, useValue: navigation },
        { provide: ClientLogService, useValue: { error: vi.fn() } },
      ],
    });
  });

  it('opens the only layout when the camera is ready', async () => {
    currentCamera.set({ driver: 'demo', available: true });
    const service = TestBed.inject(FotoboxStartService);
    await expect(
      service.start({ camera: 'demo', layouts: ['Einzelbild'] }),
    ).resolves.toBe(true);
    expect(cameraStore.initializeCamera).not.toHaveBeenCalled();
    expect(cameraStore.startLiveView).toHaveBeenCalled();
    expect(navigation.navigateToLayout).toHaveBeenCalledWith('Einzelbild');
    expect(service.starting()).toBe(false);
  });

  it('initialises the camera first and opens the entry point', async () => {
    const camera$ = signal<{
      currentCamera: { driver: string; available: boolean } | null;
      isLoading: boolean;
      error: string | null;
    }>({ currentCamera: null, isLoading: true, error: null });
    cameraStore.camera$ = camera$ as never;
    const service = TestBed.inject(FotoboxStartService);
    const started = service.start({ camera: 'demo', layouts: ['a', 'b'] });
    expect(cameraStore.initializeCamera).toHaveBeenCalledWith('demo');
    expect(service.starting()).toBe(true);

    camera$.set({
      currentCamera: { driver: 'demo', available: true },
      isLoading: false,
      error: null,
    });
    TestBed.tick();
    await expect(started).resolves.toBe(true);
    expect(navigation.navigateToEntryPoint).toHaveBeenCalled();
  });

  it('reports a camera that fails to start', async () => {
    cameraStore.camera$ = signal({
      currentCamera: null,
      isLoading: false,
      error: 'no camera',
    }) as never;
    const service = TestBed.inject(FotoboxStartService);
    const started = service.start({ camera: 'sony', layouts: ['Einzelbild'] });
    TestBed.tick();
    await expect(started).resolves.toBe(false);
    expect(service.error()).toBe('no camera');
    expect(navigation.navigateToLayout).not.toHaveBeenCalled();
  });
});
