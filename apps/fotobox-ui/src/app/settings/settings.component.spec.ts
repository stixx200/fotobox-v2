import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
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

describe('SettingsComponent', () => {
  const isLoading = signal(false);
  const storeError = signal<string | null>(null);
  const updateSettings = vi.fn();
  const notification = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    isLoading.set(false);
    storeError.set(null);
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: SettingsStore,
          useValue: {
            settings: signal([]),
            isLoading,
            error: storeError,
            updateSettings,
          },
        },
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

  describe('save feedback', () => {
    function save(component: SettingsComponent, confirm = true): void {
      component.saveSettings(confirm);
      isLoading.set(true);
      TestBed.tick();
    }

    it('confirms a successful save', () => {
      const component =
        TestBed.createComponent(SettingsComponent).componentInstance;
      save(component);
      expect(updateSettings).toHaveBeenCalled();

      isLoading.set(false);
      TestBed.tick();

      expect(notification.success).toHaveBeenCalledWith('SETTINGS.SAVED');
    });

    it('does not confirm a failed save', () => {
      const component =
        TestBed.createComponent(SettingsComponent).componentInstance;
      save(component);

      storeError.set('boom');
      isLoading.set(false);
      TestBed.tick();

      expect(notification.success).not.toHaveBeenCalled();
    });

    it('stays silent when saving as part of "start"', () => {
      const component =
        TestBed.createComponent(SettingsComponent).componentInstance;
      save(component, false);

      isLoading.set(false);
      TestBed.tick();

      expect(notification.success).not.toHaveBeenCalled();
    });
  });
});
