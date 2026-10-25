import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import {
  SettingsStore,
  CameraStore,
  AppMetadataStore,
  PrinterStore,
} from '../store';
import { CollageService } from '../services/collage.service';
import { LayoutNavigationService } from '../services/layout-navigation.service';
import { ClientLogService } from '../services/client-log.service';
import { ShareService } from '../services/share.service';
import { provideTranslateService } from '@ngx-translate/core';
import { NotificationService } from '../services/notification.service';
import { SettingsService } from '../services/settings.service';

describe('SettingsComponent', () => {
  const settings = signal<{ key: string; value: string }[]>([]);
  const updateSettings = vi.fn();
  const applySavedSettings = vi.fn();
  const notification = { success: vi.fn(), error: vi.fn() };
  const dialogResult = { confirmed: true };

  beforeEach(async () => {
    settings.set([]);
    vi.clearAllMocks();
    // The server echoes what it saved.
    updateSettings.mockImplementation((input: unknown[]) => of(input));
    TestBed.overrideProvider(MatDialog, {
      useValue: {
        open: () => ({ afterClosed: () => of(dialogResult.confirmed) }),
      },
    });
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: SettingsStore,
          useValue: {
            settings,
            isLoading: signal(false),
            error: signal(null),
            applySavedSettings,
          },
        },
        { provide: SettingsService, useValue: { updateSettings } },
        {
          provide: CameraStore,
          useValue: {
            availableCameras: signal([]),
            availableCameraNames: signal([]),
            camera$: signal(null),
          },
        },
        {
          provide: AppMetadataStore,
          useValue: {
            version: signal('0.0.0-test'),
          },
        },
        {
          provide: PrinterStore,
          useValue: {
            printerNames: signal([]),
            isLoading: signal(false),
            error: signal(null),
            defaultPrinter: signal(null),
            loadAvailablePrinters: () => undefined,
          },
        },
        {
          provide: CollageService,
          useValue: {
            getAvailableLayoutIds: () => of(['Einzelbild', '2x2', 'Strip']),
            getLayoutPreview: (layout: string) => of(`preview:${layout}`),
          },
        },
        {
          provide: LayoutNavigationService,
          useValue: {
            navigateToLayout: () => undefined,
          },
        },
        {
          provide: ClientLogService,
          useValue: {
            error: () => undefined,
          },
        },
        {
          provide: ShareService,
          useValue: {
            getDetectedShareBaseUrl: () => of(''),
          },
        },
        { provide: NotificationService, useValue: notification },
        // Real service without translations: `instant` returns the key.
        provideTranslateService(),
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.layouts()).toEqual(['Einzelbild']);
    expect(fixture.componentInstance.cameras).toEqual(['Sony', 'Demo']);
  });

  describe('layout preview', () => {
    /** Layouts load once settings arrive; trigger that load directly. */
    function createWithLayouts(): SettingsComponent {
      const component =
        TestBed.createComponent(SettingsComponent).componentInstance;
      component.refreshTemplates();
      return component;
    }

    it('shows the first layout without opening the list', () => {
      const component = createWithLayouts();
      expect(component.layoutPreview()).toEqual({
        layout: 'Einzelbild',
        url: 'preview:Einzelbild',
      });
    });

    it('prefers the first selected layout', () => {
      const component = createWithLayouts();
      component.settingsForm.patchValue({ layouts: ['Strip', '2x2'] });
      component.refreshTemplates();
      expect(component.layoutPreview()?.layout).toBe('Strip');
    });

    it('shows the hovered layout and returns to the selection on close', () => {
      const component = createWithLayouts();
      component.settingsForm.patchValue({ layouts: ['2x2'] });
      component.onLayoutsSelectOpened();
      component.showLayoutPreview('Strip');
      expect(component.layoutPreview()).toEqual({
        layout: 'Strip',
        url: 'preview:Strip',
      });
      component.onLayoutsSelectClosed();
      expect(component.layoutPreview()?.layout).toBe('2x2');
    });
  });

  describe('auto-save', () => {
    const stored = [
      { key: 'shutterTimeout', value: '5' },
      { key: 'photoDirectory', value: '"/photos"' },
    ];

    function createLoaded(): SettingsComponent {
      settings.set(stored);
      const component =
        TestBed.createComponent(SettingsComponent).componentInstance;
      TestBed.tick();
      return component;
    }

    function savedKeys(): string[] {
      return updateSettings.mock.calls
        .flatMap(([input]) => input as { key: string }[])
        .map((entry) => entry.key);
    }

    it('saves changed fields and reports it', async () => {
      const component = createLoaded();
      component.settingsForm.patchValue({ shutterTimeout: 8 });
      await component.autosave();

      expect(updateSettings).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'shutterTimeout', value: '8' }]),
      );
      expect(savedKeys()).not.toContain('photoDirectory');
      expect(applySavedSettings).toHaveBeenCalled();
      expect(component.saveState()).toBe('saved');
    });

    it('does not save before the stored settings are loaded', async () => {
      const component =
        TestBed.createComponent(SettingsComponent).componentInstance;
      component.settingsForm.patchValue({ shutterTimeout: 8 });
      await component.autosave();
      expect(updateSettings).not.toHaveBeenCalled();
    });

    it('holds back an incomplete PIN', async () => {
      const component = createLoaded();
      component.settingsForm.patchValue({ operatorPin: '12', autoStart: true });
      await component.autosave();

      expect(savedKeys()).toContain('autoStart');
      expect(savedKeys()).not.toContain('operatorPin');
      expect(component.hasIncompleteInput()).toBe(true);
    });

    it('shows a failed save', async () => {
      updateSettings.mockReturnValue(throwError(() => new Error('offline')));
      const component = createLoaded();
      component.settingsForm.patchValue({ shutterTimeout: 8 });
      await component.autosave();
      expect(component.saveState()).toBe('error');
    });

    it('restores the defaults after confirmation', async () => {
      dialogResult.confirmed = true;
      const component = createLoaded();
      await component.restoreDefaults();

      expect(component.settingsForm.controls.photoDirectory.value).toBe('');
      expect(updateSettings).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'photoDirectory', value: '""' }]),
      );
      expect(notification.success).toHaveBeenCalledWith(
        'SETTINGS.RESTORE_DEFAULTS_DONE',
      );
    });

    it('keeps the settings when restoring is cancelled', async () => {
      dialogResult.confirmed = false;
      const component = createLoaded();
      await component.restoreDefaults();

      expect(component.settingsForm.controls.photoDirectory.value).toBe(
        '/photos',
      );
      expect(updateSettings).not.toHaveBeenCalled();
    });
  });
});
