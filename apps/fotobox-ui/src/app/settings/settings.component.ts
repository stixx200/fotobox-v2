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
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidatorFn,
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
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, finalize, firstValueFrom, merge } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SettingsStore,
  CameraStore,
  AppMetadataStore,
  PrinterStore,
} from '../store';
import { MatDialog } from '@angular/material/dialog';
import {
  DirectoryPickerData,
  DirectoryPickerDialogComponent,
} from './components/directory-picker-dialog.component';
import {
  isDesktopHost,
  openCollageEditorWindow,
  pickDirectory,
} from '@fotobox/frontend-core';
import { CollageService } from '../services/collage.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  PIN_LENGTH,
  isOptionalPin,
  sanitizePinInput,
} from '../services/pin.util';
import {
  FotoboxStartService,
  resolveStartConfig,
} from '../services/fotobox-start.service';
import { ShareService } from '../services/share.service';
import { NotificationService } from '../services/notification.service';
import { SettingsCameraLayoutsComponent } from './components/settings-camera-layouts.component';
import { SettingsShareGalleryComponent } from './components/settings-share-gallery.component';
import { SettingsOperationComponent } from './components/settings-operation.component';
import { RestoreDefaultsDialogComponent } from './components/restore-defaults-dialog.component';
import { SettingsService } from '../services/settings.service';
import { changedSettings, DEFAULT_SETTINGS } from './settings-autosave';

/** Pause after the last change before it is saved. */
const AUTOSAVE_DEBOUNCE_MS = 600;

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Form validator: empty or exactly four digits. */
function optionalPinValidator(errorKey: string): ValidatorFn {
  return (control) =>
    isOptionalPin(String(control.value ?? '')) ? null : { [errorKey]: true };
}

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
    SettingsCameraLayoutsComponent,
    SettingsShareGalleryComponent,
    SettingsOperationComponent,
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
  private readonly fotoboxStart = inject(FotoboxStartService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly shareService = inject(ShareService);
  private readonly notification = inject(NotificationService);
  private readonly settingsService = inject(SettingsService);

  /** Auto-save status shown in the header. */
  readonly saveState = signal<AutosaveState>('idle');
  /** Some fields hold incomplete input (e.g. a 2-digit PIN) that isn't saved. */
  readonly hasIncompleteInput = signal(false);
  /** Stored value (JSON) per key, i.e. what the server has. */
  private readonly persisted = new Map<string, string>();
  /** The form was filled from the stored settings; saving may start. */
  private formLoaded = false;
  /** The layout list is open: save once it closes, not on every click. */
  private layoutSelectOpen = false;
  private saveInFlight: Promise<void> | null = null;
  private saveAgain = false;

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
  readonly printersLoading = this.printerStore.isLoading;
  readonly printersError = this.printerStore.error;
  readonly appVersion = this.appMetadataStore.version;

  // Layouts signal - starts with Einzelbild only, updated dynamically
  layouts = signal<string[]>(['Einzelbild']);
  readonly layoutPreviews = signal<Map<string, string>>(new Map());
  readonly layoutPreview = signal<{
    layout: string;
    url: string;
  } | null>(null);
  collageDirectoryError = signal<string | null>(null);
  readonly refreshingTemplates = signal(false);
  readonly isInitializingCamera = this.fotoboxStart.starting;
  readonly startError = this.fotoboxStart.error;

  private readonly MAX_LAYOUTS = 3;
  maxLayoutsReached = signal(false);
  readonly detectedShareBaseUrl = signal('');
  readonly shareExpanded = signal(false);
  readonly galleryExpanded = signal(false);
  readonly settingsForm = new FormGroup(
    {
      shutterTimeout: new FormControl(DEFAULT_SETTINGS.shutterTimeout),
      usePrinter: new FormControl(DEFAULT_SETTINGS.usePrinter),
      useShare: new FormControl(DEFAULT_SETTINGS.useShare),
      shareBaseUrl: new FormControl(DEFAULT_SETTINGS.shareBaseUrl),
      shareTokenExpiryHours: new FormControl(
        DEFAULT_SETTINGS.shareTokenExpiryHours,
        { validators: [Validators.min(1)] },
      ),
      printerName: new FormControl(DEFAULT_SETTINGS.printerName),
      showPrintDialog: new FormControl(DEFAULT_SETTINGS.showPrintDialog),
      photoDirectory: new FormControl(DEFAULT_SETTINGS.photoDirectory),
      collageDirectory: new FormControl(DEFAULT_SETTINGS.collageDirectory),
      layouts: new FormControl<string[]>([...DEFAULT_SETTINGS.layouts]),
      camera: new FormControl(DEFAULT_SETTINGS.camera),
      galleryPassword: new FormControl(DEFAULT_SETTINGS.galleryPassword, {
        validators: [optionalPinValidator('galleryPin')],
      }),
      showGalleryButton: new FormControl(DEFAULT_SETTINGS.showGalleryButton),
      operatorPin: new FormControl(DEFAULT_SETTINGS.operatorPin, {
        validators: [optionalPinValidator('operatorPin')],
      }),
      autoStart: new FormControl(DEFAULT_SETTINGS.autoStart),
    },
    {},
  );

  cameras = ['Sony', 'Demo'];
  /** Native folder pickers are only available in the desktop app. */
  readonly isDesktopHost = isDesktopHost();

  constructor() {
    // Overlays (select panels, dialogs, snackbars) live outside the page, so
    // the chosen scheme is mirrored onto <html> while settings are open.
    effect(() => {
      document.documentElement.style.colorScheme = this.currentTheme();
    });

    // Track what is stored. The form is filled from it only once: later
    // updates come from our own auto-saves and must not overwrite what the
    // operator is typing.
    effect(() => {
      const settingsArray = this.settings();
      for (const setting of settingsArray) {
        this.persisted.set(setting.key, setting.value);
      }
      if (settingsArray.length > 0 && !this.formLoaded) {
        this.formLoaded = true;
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

    effect(() => {
      const names = this.availablePrinterNames();
      if (names.length === 0) {
        return;
      }

      this.selectDefaultPrinter();
    });
  }

  /** Pick the system default printer when none (or an unknown one) is set. */
  private selectDefaultPrinter(): void {
    const names = this.availablePrinterNames();
    const control = this.settingsForm.controls.printerName;
    const current = String(control.value ?? '').trim();
    if (names.length === 0 || (current && names.includes(current))) {
      return;
    }
    const preferred = this.printerStore.defaultPrinter() ?? names[0];
    if (preferred && preferred !== control.value) {
      control.setValue(preferred);
      this.cdr.markForCheck();
    }
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

    merge(
      this.settingsForm.controls.galleryPassword.valueChanges,
      this.settingsForm.controls.operatorPin.valueChanges,
    )
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

    // Auto-save: shortly after the last change (the layout list saves when
    // it closes, see onLayoutsSelectClosed).
    merge(this.settingsForm.valueChanges, this.settingsForm.statusChanges)
      .pipe(debounceTime(AUTOSAVE_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.layoutSelectOpen) {
          void this.autosave();
        }
      });
  }

  /** Invalid fields are kept out of the save until they become valid. */
  private invalidKeys(): Set<string> {
    const controls = this.settingsForm.controls;
    return new Set(
      (Object.keys(controls) as (keyof typeof controls)[]).filter(
        (key) => controls[key].invalid,
      ),
    );
  }

  /**
   * Saves every changed, valid field. Changes made while a save is running
   * are saved right after it. Resolves when everything is stored (or failed).
   */
  autosave(): Promise<void> {
    if (!this.formLoaded) {
      return Promise.resolve();
    }
    if (this.saveInFlight) {
      this.saveAgain = true;
      return this.saveInFlight;
    }
    const skip = this.invalidKeys();
    this.hasIncompleteInput.set(skip.size > 0);
    const changes = changedSettings(
      this.settingsForm.getRawValue(),
      this.persisted,
      skip,
    );
    if (changes.length === 0) {
      this.cdr.markForCheck();
      return Promise.resolve();
    }

    this.saveState.set('saving');
    this.cdr.markForCheck();
    this.saveInFlight = (async () => {
      try {
        const saved = await firstValueFrom(
          this.settingsService.updateSettings(changes),
        );
        for (const setting of saved) {
          this.persisted.set(setting.key, setting.value);
        }
        this.settingsStore.applySavedSettings(saved);
        this.saveState.set('saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
        this.saveState.set('error');
      } finally {
        this.saveInFlight = null;
        this.cdr.markForCheck();
      }
      if (this.saveAgain) {
        this.saveAgain = false;
        await this.autosave();
      }
    })();
    return this.saveInFlight;
  }

  retrySave(): void {
    void this.autosave();
  }

  /** "Standard wiederherstellen": after confirmation, reset every field. */
  async restoreDefaults(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<
          RestoreDefaultsDialogComponent,
          void,
          boolean
        >(RestoreDefaultsDialogComponent, { autoFocus: 'first-tabbable' })
        .afterClosed(),
    );
    if (!confirmed) {
      return;
    }
    this.settingsForm.reset({
      ...DEFAULT_SETTINGS,
      layouts: [...DEFAULT_SETTINGS.layouts],
    });
    this.selectDefaultPrinter();
    this.syncExpertPanelsFromForm();
    this.loadAvailableLayouts(undefined);
    await this.autosave();
    if (this.saveState() === 'saved') {
      this.notification.success(
        this.translateService.instant('SETTINGS.RESTORE_DEFAULTS_DONE'),
      );
    }
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
      const rawValue = settingsMap.get(key);
      if (control && rawValue !== undefined) {
        try {
          const value = JSON.parse(rawValue);
          control.setValue(value, { emitEvent: false });
        } catch (error) {
          console.error(`Failed to parse setting ${key}:`, error);
        }
      }
    });

    this.syncExpertPanelsFromForm();
    this.selectDefaultPrinter();

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
    // Leaving the page (e.g. into the guest flow): save what is pending.
    void this.autosave();
    document.documentElement.style.colorScheme = '';
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshPrinters(): void {
    this.printerStore.loadAvailablePrinters();
  }

  refreshTemplates(): void {
    const collageDir =
      this.settingsForm.get('collageDirectory')?.value || undefined;
    this.loadAvailableLayouts(collageDir, true);
  }

  private loadAvailableLayouts(
    collageDirectory?: string,
    userInitiated = false,
  ): void {
    if (userInitiated) {
      this.refreshingTemplates.set(true);
    }
    this.layoutPreview.set(null);
    this.collageService
      .getAvailableLayoutIds(collageDirectory)
      .pipe(
        finalize(() => {
          if (userInitiated) {
            this.refreshingTemplates.set(false);
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (layoutIds) => {
          this.layouts.set(layoutIds);
          this.collageDirectoryError.set(null);
          this.layoutPreviews.set(new Map());
          this.showDefaultLayoutPreview();
          this.loadLayoutPreviews(layoutIds, collageDirectory);
        },
        error: (error) => {
          console.error('Error loading available layouts:', error);
          // Fallback to just Einzelbild if there's an error
          const fallbackLayouts = ['Einzelbild'];
          this.layouts.set(fallbackLayouts);
          this.layoutPreviews.set(new Map());
          this.showDefaultLayoutPreview();
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

  /**
   * The preview pane always shows a collage: the first selected layout, or the
   * first available one when nothing is selected. Hovering an option in the
   * open list temporarily shows that option instead.
   */
  showDefaultLayoutPreview(): void {
    const selected: string[] = this.settingsForm.get('layouts')?.value ?? [];
    const layouts = this.layouts();
    const layoutToPreview =
      selected.find((layout) => layouts.includes(layout)) ?? layouts[0];
    if (layoutToPreview) {
      this.showLayoutPreview(layoutToPreview);
    } else {
      this.layoutPreview.set(null);
      this.cdr.markForCheck();
    }
  }

  onLayoutsSelectOpened(): void {
    this.layoutSelectOpen = true;
    this.showDefaultLayoutPreview();
  }

  onLayoutsSelectClosed(): void {
    this.layoutSelectOpen = false;
    // Back to the (possibly changed) selection after hovering other options.
    this.showDefaultLayoutPreview();
    void this.autosave();
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

  async startFotobox(): Promise<void> {
    const config = resolveStartConfig(this.settingsForm.getRawValue());
    if (!config) {
      // Never start with a malformed PIN.
      this.markPinFieldsTouched();
      return;
    }
    // Store pending changes before leaving the page.
    await this.autosave();
    await this.fotoboxStart.start(config);
    this.cdr.markForCheck();
  }

  readonly galleryPinLength = PIN_LENGTH;

  onGalleryPinInput(event: Event): void {
    this.applyPinInput(event, 'galleryPassword');
  }

  onOperatorPinInput(event: Event): void {
    this.applyPinInput(event, 'operatorPin');
  }

  private applyPinInput(
    event: Event,
    control: 'galleryPassword' | 'operatorPin',
  ): void {
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizePinInput(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.settingsForm.controls[control].setValue(sanitized);
    this.cdr.markForCheck();
  }

  private markPinFieldsTouched(): void {
    this.settingsForm.controls.galleryPassword.markAsTouched();
    this.settingsForm.controls.operatorPin.markAsTouched();
    this.cdr.markForCheck();
  }

  handleDirectoryClick(fieldName: string): void {
    void this.openPicker(fieldName);
  }

  openCollageEditor(): void {
    const collageDir = this.settingsForm.get('collageDirectory')?.value;
    void openCollageEditorWindow(collageDir || undefined).then((opened) => {
      if (!opened) {
        const params = collageDir
          ? `?dir=${encodeURIComponent(collageDir)}`
          : '';
        window.open(`http://localhost:4201/${params}`, '_blank');
      }
    });
  }

  /**
   * Folder picker for path settings: the native dialog in the desktop app,
   * otherwise a dialog that browses the host's folders through the API (a web
   * page cannot read the host's filesystem itself).
   */
  async openPicker(fieldName: string): Promise<void> {
    try {
      const selectedPath = this.isDesktopHost
        ? await pickDirectory()
        : await this.pickDirectoryViaApi(fieldName);
      if (selectedPath) {
        this.settingsForm.patchValue({ [fieldName]: selectedPath });
        this.cdr.markForCheck();
      }
    } catch (error) {
      console.error('Error opening directory picker:', error);
    }
  }

  private pickDirectoryViaApi(fieldName: string): Promise<string | undefined> {
    const titleKey =
      fieldName === 'collageDirectory'
        ? 'SETTINGS.COLLAGE_DIRECTORY'
        : 'SETTINGS.PHOTO_DIRECTORY';
    const dialogRef = this.dialog.open<
      DirectoryPickerDialogComponent,
      DirectoryPickerData,
      string
    >(DirectoryPickerDialogComponent, {
      data: {
        title: this.translateService.instant(titleKey),
        initialPath: this.settingsForm.get(fieldName)?.value,
      },
      autoFocus: 'first-tabbable',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  isLayoutOptionDisabled(layout: string): boolean {
    const selectedLayouts = this.settingsForm.get('layouts')?.value || [];
    return (
      selectedLayouts.length >= this.MAX_LAYOUTS &&
      !selectedLayouts.includes(layout)
    );
  }

  layoutPreviewUrls(): Record<string, string> {
    return Object.fromEntries(this.layoutPreviews());
  }

  layoutDisabledMap(): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const layout of this.layouts()) {
      map[layout] = this.isLayoutOptionDisabled(layout);
    }
    return map;
  }
}
