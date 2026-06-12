import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  effect,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, filter, merge, take } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SettingsStore,
  CameraStore,
  AppMetadataStore,
  PrinterStore,
} from '../store';
import { CollageService } from '../services/collage.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  GALLERY_LENGTH,
  isOptionalGalleryPin,
  sanitizeGalleryPinInput,
} from '../services/gallery-pin.util';
import { LayoutNavigationService } from '../services/layout-navigation.service';
import { ClientLogService } from '../services/client-log.service';
import { ShareService } from '../services/share.service';

/** @title Form field with label */
@Component({
  selector: 'app-settings',
  templateUrl: 'settings.component.html',
  styleUrl: 'settings.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit, OnDestroy {
  // Inject stores
  readonly settingsStore = inject(SettingsStore);
  readonly cameraStore = inject(CameraStore);
  readonly appMetadataStore = inject(AppMetadataStore);
  readonly printerStore = inject(PrinterStore);
  readonly collageService = inject(CollageService);
  private readonly router = inject(Router);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);
  private readonly clientLogService = inject(ClientLogService);
  private readonly shareService = inject(ShareService);

  readonly currentLang = signal<string>(
    this.translateService.currentLang() || 'de',
  );
  readonly availableLangs = ['de', 'en'] as const;

  private readonly THEME_KEY = 'fotobox.theme';
  readonly currentTheme = signal<'light' | 'dark'>(
    (() => {
      try {
        const stored = localStorage.getItem(this.THEME_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } catch {
        return 'light';
      }
    })(),
  );

  toggleTheme(): void {
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.currentTheme.set(next);
    try {
      localStorage.setItem(this.THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  private destroy$ = new Subject<void>();

  // Signal selectors from stores
  readonly settings = this.settingsStore.settings;
  readonly settingsIsLoading = this.settingsStore.isLoading;
  readonly settingsError = this.settingsStore.error;
  readonly availableCameras = this.cameraStore.availableCameras;
  readonly availableCameraNames = this.cameraStore.availableCameraNames;
  readonly availablePrinterNames = this.printerStore.printerNames;
  readonly appVersion = this.appMetadataStore.version;

  // Layouts signal - starts with Einzelbild only, updated dynamically
  layouts = signal<string[]>(['Einzelbild']);
  readonly layoutPreviews = signal<Map<string, string>>(new Map());
  readonly layoutPreview = signal<{
    layout: string;
    url: string;
  } | null>(null);
  collageDirectoryError = signal<string | null>(null);
  layoutsAutoSelectionMessage = signal<string | null>(null);
  isInitializingCamera = signal(false);
  startError = signal<string | null>(null);
  camera$ = toObservable(this.cameraStore.camera$);

  private readonly MAX_LAYOUTS = 3;
  maxLayoutsReached = signal(false);
  readonly detectedShareBaseUrl = signal('');
  readonly shareExpanded = signal(false);
  readonly galleryExpanded = signal(false);
  readonly hasUnsavedChanges = signal(false);

  private savedFormSnapshot: string | null = null;

  readonly settingsForm = new FormGroup(
    {
      shutterTimeout: new FormControl(5),
      usePrinter: new FormControl(true),
      useShare: new FormControl(false),
      shareBaseUrl: new FormControl(''),
      shareTokenExpiryHours: new FormControl(24, {
        validators: [Validators.min(1)],
      }),
      printerName: new FormControl('printer1'),
      showPrintDialog: new FormControl(false),
      photoDirectory: new FormControl(''),
      collageDirectory: new FormControl(''),
      layouts: new FormControl<string[]>([]),
      camera: new FormControl(''),
      galleryPassword: new FormControl('', {
        validators: [
          (control) =>
            isOptionalGalleryPin(String(control.value ?? ''))
              ? null
              : { galleryPin: true },
        ],
      }),
      showGalleryButton: new FormControl(false),
    },
    {},
  );

  cameras = ['Sony', 'Demo'];
  get isElectronAvailable(): boolean {
    return (
      typeof window !== 'undefined' && !!window.electron?.openDirectoryDialog
    );
  }

  constructor() {
    // Update form with loaded settings when they become available
    effect(() => {
      const settingsArray = this.settings();
      if (settingsArray.length > 0) {
        this.updateFormWithSettings();
        // Load available layouts using the loaded collageDirectory setting
        const collageDirectorySetting = settingsArray.find(
          (s) => s.key === 'collageDirectory',
        );
        if (collageDirectorySetting) {
          try {
            const collageDirectory = JSON.parse(collageDirectorySetting.value);
            this.loadAvailableLayouts(collageDirectory);
          } catch (error) {
            console.error(
              'SettingsComponent: Failed to parse collageDirectory setting:',
              error,
            );
            this.loadAvailableLayouts();
          }
        } else {
          this.loadAvailableLayouts();
        }
      }
    });
  }

  ngOnInit(): void {
    // Load available printers from backend
    this.printerStore.loadAvailablePrinters();
    this.shareService.getDetectedShareBaseUrl().subscribe({
      next: (url) => {
        this.detectedShareBaseUrl.set(url);
        this.cdr.markForCheck();
      },
    });

    // Watch for collageDirectory changes and reload available layouts
    const collageDirectoryControl = this.settingsForm.get('collageDirectory');
    if (collageDirectoryControl) {
      collageDirectoryControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          if (value) {
            this.loadAvailableLayouts(value);
          }
        });
    }

    // Watch layouts changes and update maxLayoutsReached signal
    this.settingsForm.controls.useShare.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.settingsForm.controls.galleryPassword.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.settingsForm.controls.showGalleryButton.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((enabled) => {
        if (!enabled) {
          this.galleryExpanded.set(false);
        }
        this.cdr.markForCheck();
      });

    const layoutsControl = this.settingsForm.get('layouts');
    if (layoutsControl) {
      layoutsControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          this.maxLayoutsReached.set(
            !!(value && value.length >= this.MAX_LAYOUTS),
          );
        });
      // Set initial state
      this.maxLayoutsReached.set(
        !!(
          layoutsControl.value &&
          layoutsControl.value.length >= this.MAX_LAYOUTS
        ),
      );
    }

    merge(this.settingsForm.valueChanges, this.settingsForm.statusChanges)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncDirtyState());
  }

  private captureFormSnapshot(): string {
    return JSON.stringify(this.settingsForm.getRawValue());
  }

  private updateSavedSnapshot(): void {
    this.savedFormSnapshot = this.captureFormSnapshot();
    this.hasUnsavedChanges.set(false);
  }

  private syncDirtyState(): void {
    if (this.savedFormSnapshot === null) {
      this.hasUnsavedChanges.set(false);
      return;
    }

    const dirty = this.captureFormSnapshot() !== this.savedFormSnapshot;
    this.hasUnsavedChanges.set(dirty);
    this.cdr.markForCheck();
  }

  private updateFormWithSettings(): void {
    const settingsArray = this.settings();

    // Create a map of loaded settings
    const settingsMap = new Map<string, string>();
    settingsArray.forEach((setting) => {
      settingsMap.set(setting.key, setting.value);
    });

    // Update all form controls
    Object.keys(this.settingsForm.controls).forEach((key) => {
      const control = this.settingsForm.get(key);
      if (control && settingsMap.has(key)) {
        try {
          const rawValue = settingsMap.get(key)!;
          const value = JSON.parse(rawValue);
          control.setValue(value, { emitEvent: false });
        } catch (error) {
          console.error(`Failed to parse setting ${key}:`, error);
        }
      } else {
      }
    });

    this.syncExpertPanelsFromForm();
    this.updateSavedSnapshot();

    // Trigger change detection for OnPush
    this.cdr.markForCheck();
  }

  toggleShareExpanded(): void {
    this.shareExpanded.update((v) => !v);
  }

  toggleGalleryExpanded(): void {
    this.galleryExpanded.update((v) => !v);
  }

  shareStatusLabel(): string {
    return this.settingsForm.controls.useShare.value
      ? this.translateService.instant('SETTINGS.SHARE_STATUS_ON')
      : this.translateService.instant('SETTINGS.SHARE_STATUS_OFF');
  }

  galleryStatusLabel(): string {
    if (this.settingsForm.controls.showGalleryButton.value === false) {
      return this.translateService.instant('SETTINGS.GALLERY_STATUS_HIDDEN');
    }
    const pin = String(this.settingsForm.controls.galleryPassword.value ?? '');
    return pin.length > 0
      ? this.translateService.instant('SETTINGS.GALLERY_STATUS_PIN')
      : this.translateService.instant('SETTINGS.GALLERY_STATUS_OPEN');
  }

  private syncExpertPanelsFromForm(): void {
    if (this.settingsForm.controls.useShare.value) {
      this.shareExpanded.set(true);
    }

    const galleryEnabled =
      this.settingsForm.controls.showGalleryButton.value === true;
    if (!galleryEnabled) {
      this.galleryExpanded.set(false);
      return;
    }

    const pin = String(this.settingsForm.controls.galleryPassword.value ?? '');
    if (pin.length > 0) {
      this.galleryExpanded.set(true);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAvailableLayouts(collageDirectory?: string): void {
    this.layoutPreview.set(null);
    this.collageService.getAvailableLayoutIds(collageDirectory).subscribe({
      next: (layoutIds) => {
        this.layouts.set(layoutIds);
        this.collageDirectoryError.set(null);
        this.layoutPreviews.set(new Map());
        this.loadLayoutPreviews(layoutIds, collageDirectory);
      },
      error: (error) => {
        console.error('Error loading available layouts:', error);
        // Fallback to just Einzelbild if there's an error
        const fallbackLayouts = ['Einzelbild'];
        this.layouts.set(fallbackLayouts);
        this.layoutPreviews.set(new Map());
        this.loadLayoutPreviews(fallbackLayouts, collageDirectory);
        this.collageDirectoryError.set(
          this.translateService.instant('SETTINGS.COLLAGE_DIRECTORY_ERROR'),
        );
      },
    });
  }

  getLayoutPreview(layout: string): string | null {
    return this.layoutPreviews().get(layout) ?? null;
  }

  showLayoutPreview(layout: string): void {
    const url = this.getLayoutPreview(layout);
    this.layoutPreview.set({ layout, url: url ?? '' });
    this.cdr.markForCheck();
  }

  onLayoutsSelectOpened(): void {
    const selected = this.settingsForm.get('layouts')?.value ?? [];
    const firstSelected = selected[0];
    const layoutToPreview = firstSelected ?? this.layouts()[0];
    if (layoutToPreview) {
      this.showLayoutPreview(layoutToPreview);
    }
  }

  onLayoutsSelectClosed(): void {
    this.layoutPreview.set(null);
    this.cdr.markForCheck();
  }

  /** On touch devices, tap the preview pane to step through layouts. */
  cycleLayoutPreview(): void {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }

    const layouts = this.layouts();
    if (layouts.length === 0) {
      return;
    }

    const currentLayout = this.layoutPreview()?.layout;
    const currentIndex = currentLayout ? layouts.indexOf(currentLayout) : -1;
    const nextLayout = layouts[(currentIndex + 1) % layouts.length];
    this.showLayoutPreview(nextLayout);
  }

  private loadLayoutPreviews(
    layoutIds: string[],
    collageDirectory?: string,
  ): void {
    const directory =
      collageDirectory ||
      this.settingsForm.get('collageDirectory')?.value ||
      undefined;

    for (const layout of layoutIds) {
      this.collageService.getLayoutPreview(layout, directory).subscribe({
        next: (previewUrl) => {
          this.layoutPreviews.update((previews) => {
            const next = new Map(previews);
            next.set(layout, previewUrl);
            return next;
          });
          const current = this.layoutPreview();
          if (current?.layout === layout && !current.url) {
            this.layoutPreview.set({ layout, url: previewUrl });
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error(`Error loading preview for ${layout}:`, error);
        },
      });
    }
  }

  setLanguage(lang: string): void {
    this.translateService.use(lang);
    this.currentLang.set(lang);
    try {
      localStorage.setItem('fotobox.language', lang);
    } catch {
      /* ignore */
    }
  }

  startFotobox(): void {
    // Save settings first
    this.saveSettings();

    this.startError.set(null);
    // Mark that we're initializing
    this.isInitializingCamera.set(true);

    // Initialize camera with selected driver
    this.initializeCameraAndWaitForLoading();
  }

  private initializeCameraAndWaitForLoading(): void {
    const selectedCamera = this.settingsForm.get('camera')?.value;
    const currentCamera = this.cameraStore.currentCamera();

    if (
      !currentCamera ||
      currentCamera.driver === 'none' ||
      !currentCamera.available
    ) {
      const driverToInit = selectedCamera || 'demo';

      // Initialize the camera
      this.cameraStore.initializeCamera(driverToInit);

      // Watch for camera initialization completion using observables
      this.watchForCameraInitialization(driverToInit);
    } else {
      // Check if live view is active, if not start it
      const isLiveViewActive = this.cameraStore.isLiveViewActive();
      if (!isLiveViewActive) {
        this.cameraStore.startLiveView();
      }

      // Navigate to home
      this.navigateToHome();
    }
  }

  private watchForCameraInitialization(driverToInit: string): void {
    this.camera$
      .pipe(
        filter(({ isLoading }) => !isLoading),
        filter(({ currentCamera, error }) => {
          const isReady =
            !!currentCamera &&
            currentCamera.driver === driverToInit &&
            currentCamera.available;
          if (isReady) {
            return true;
          }
          if (error) {
            return true;
          }
          return (
            currentCamera?.driver === driverToInit && !currentCamera.available
          );
        }),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe(({ currentCamera, error }) => {
        const isReady =
          currentCamera &&
          currentCamera.driver === driverToInit &&
          currentCamera.available;

        if (!isReady) {
          const message =
            error || this.translateService.instant('SETTINGS.START_FAILED');
          this.startError.set(message);
          this.clientLogService.error('Fotobox start failed', message);
          this.isInitializingCamera.set(false);
          this.cdr.markForCheck();
          return;
        }

        this.cameraStore.startLiveView();
        this.navigateToHome();
      });
  }

  private navigateToHome(): void {
    this.isInitializingCamera.set(false);

    // Prefer the form value — saveSettings may still be persisting to the store.
    const formLayouts = this.settingsForm.get('layouts')?.value;
    if (formLayouts?.length === 1) {
      void this.layoutNavigation.navigateToLayout(formLayouts[0]);
      return;
    }

    this.layoutNavigation.navigateToEntryPoint().catch((err) => {
      console.error('Navigation after start failed:', err);
    });
  }

  readonly galleryPinLength = GALLERY_LENGTH;

  onGalleryPinInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeGalleryPinInput(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.settingsForm.controls.galleryPassword.setValue(sanitized);
    this.cdr.markForCheck();
  }

  saveSettings(): void {
    if (this.settingsForm.controls.galleryPassword.invalid) {
      this.settingsForm.controls.galleryPassword.markAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const formValue = this.settingsForm.value;

    // Clear previous message
    this.layoutsAutoSelectionMessage.set(null);

    // Check if layouts is empty or null
    let layoutsValue = formValue.layouts;
    if (!layoutsValue || layoutsValue.length === 0) {
      layoutsValue = ['Einzelbild'];
      this.settingsForm.patchValue(
        { layouts: layoutsValue },
        { emitEvent: false },
      );
      this.layoutsAutoSelectionMessage.set(
        'Einzelbild wurde automatisch ausgewählt, da keine Layouts angegeben waren.',
      );
    }

    const settingsArray = Object.entries(formValue).map(([key, value]) => {
      if (key === 'layouts') {
        return { key, value: JSON.stringify(layoutsValue) };
      }
      return { key, value: JSON.stringify(value) };
    });

    this.settingsStore.updateSettings(settingsArray);

    // Refresh available layouts after save
    const collageDir = this.settingsForm.get('collageDirectory')?.value;
    if (collageDir) {
      this.loadAvailableLayouts(collageDir);
    }
  }

  resetSettings(): void {
    this.settingsStore.resetSettings();
  }

  handleDirectoryClick(fieldName: string): void {
    if (this.isElectronAvailable) {
      this.openPicker(fieldName);
    }
  }

  async openPicker(fieldName: string): Promise<void> {
    if (!window.electron?.openDirectoryDialog) {
      console.warn('Electron API not available');
      return;
    }

    try {
      const result = await window.electron.openDirectoryDialog();
      const selectedPath =
        typeof result === 'string'
          ? result
          : result && typeof result === 'object' && 'filePaths' in result
            ? (() => {
                const dialogResult = result as {
                  canceled: boolean;
                  filePaths: string[];
                };
                return dialogResult.canceled
                  ? null
                  : (dialogResult.filePaths[0] ?? null);
              })()
            : null;

      if (selectedPath) {
        this.settingsForm.patchValue({ [fieldName]: selectedPath });
        this.cdr.markForCheck();
      }
    } catch (error) {
      console.error('Error opening directory picker:', error);
    }
  }

  isLayoutOptionDisabled(layout: string): boolean {
    const selectedLayouts = this.settingsForm.get('layouts')?.value || [];
    return (
      selectedLayouts.length >= this.MAX_LAYOUTS &&
      !selectedLayouts.includes(layout)
    );
  }
}
