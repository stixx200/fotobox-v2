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
import { TranslateService } from '@ngx-translate/core';

describe('SettingsComponent', () => {
  beforeEach(async () => {
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
            isLoading: signal(false),
            error: signal(null),
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
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            currentLang: () => 'en',
            use: () => of('en'),
            get: () => of(''),
            onLangChange: of({ lang: 'en' }),
            onTranslationChange: of({}),
            onDefaultLangChange: of({}),
          },
        },
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
});
