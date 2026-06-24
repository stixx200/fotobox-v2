import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
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
        provideHttpClient(),
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
          },
        },
        {
          provide: CollageService,
          useValue: {
            getAvailableLayoutIds: () => of(['Einzelbild']),
            getLayoutPreview: () => of(''),
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
});
