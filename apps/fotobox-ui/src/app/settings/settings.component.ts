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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, combineLatest, filter, take } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SettingsStore,
  CameraStore,
  AppMetadataStore,
  PrinterStore,
} from '../store';
import { CollageService } from '../services/collage.service';

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
    MatProgressSpinnerModule,
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
  private readonly cdr = inject(ChangeDetectorRef);

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
  collageDirectoryError = signal<string | null>(null);
  layoutsAutoSelectionMessage = signal<string | null>(null);
  isInitializingCamera = signal(false);
  camera$ = toObservable(this.cameraStore.camera$);

  private readonly MAX_LAYOUTS = 3;
  maxLayoutsReached = signal(false);

  readonly settingsForm = new FormGroup(
    {
      shutterTimeout: new FormControl(5),
      usePrinter: new FormControl(true),
      printerName: new FormControl('printer1'),
      photoDirectory: new FormControl(''),
      collageDirectory: new FormControl(''),
      layouts: new FormControl<string[]>([]),
      camera: new FormControl(''),
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
      console.log(
        'SettingsComponent: settings changed, count:',
        settingsArray.length,
        'isLoading:',
        this.settingsIsLoading(),
      );
      if (settingsArray.length > 0) {
        console.log(
          'SettingsComponent: Calling updateFormWithSettings with settings:',
          settingsArray,
        );
        this.updateFormWithSettings();
        // Load available layouts using the loaded collageDirectory setting
        const collageDirectorySetting = settingsArray.find(
          (s) => s.key === 'collageDirectory',
        );
        if (collageDirectorySetting) {
          try {
            const collageDirectory = JSON.parse(collageDirectorySetting.value);
            console.log(
              'SettingsComponent: Loading layouts with collageDirectory:',
              collageDirectory,
            );
            this.loadAvailableLayouts(collageDirectory);
          } catch (error) {
            console.error(
              'SettingsComponent: Failed to parse collageDirectory setting:',
              error,
            );
            this.loadAvailableLayouts();
          }
        } else {
          console.log(
            'SettingsComponent: No collageDirectory setting found, loading default layouts',
          );
          this.loadAvailableLayouts();
        }
      }
    });
  }

  ngOnInit(): void {
    // Load available printers from backend
    this.printerStore.loadAvailablePrinters();

    // Watch for collageDirectory changes and reload available layouts
    const collageDirectoryControl = this.settingsForm.get('collageDirectory');
    if (collageDirectoryControl) {
      collageDirectoryControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          console.log('collageDirectory changed:', value);
          if (value) {
            this.loadAvailableLayouts(value);
          }
        });
    }

    // Watch layouts changes and update maxLayoutsReached signal
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
  }

  private updateFormWithSettings(): void {
    const settingsArray = this.settings();

    console.log('Updating form with settings:', settingsArray);

    // Create a map of loaded settings
    const settingsMap = new Map<string, string>();
    settingsArray.forEach((setting) => {
      settingsMap.set(setting.key, setting.value);
    });

    console.log('Settings map:', Object.fromEntries(settingsMap));

    // Update all form controls
    Object.keys(this.settingsForm.controls).forEach((key) => {
      const control = this.settingsForm.get(key);
      if (control && settingsMap.has(key)) {
        try {
          const rawValue = settingsMap.get(key)!;
          const value = JSON.parse(rawValue);
          console.log(
            `Setting form control ${key} to:`,
            value,
            '(raw:',
            rawValue,
            ')',
          );
          control.setValue(value, { emitEvent: false });
          console.log(`Form control ${key} value after set:`, control.value);
        } catch (error) {
          console.error(`Failed to parse setting ${key}:`, error);
        }
      } else {
        console.log(`No setting found for form control ${key}`);
      }
    });

    console.log('Form value after update:', this.settingsForm.value);

    // Trigger change detection for OnPush
    this.cdr.markForCheck();
    console.log('Change detection marked for check');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAvailableLayouts(collageDirectory?: string): void {
    this.collageService.getAvailableLayoutIds(collageDirectory).subscribe({
      next: (layoutIds) => {
        console.log('Available layouts:', layoutIds);
        this.layouts.set(layoutIds);
        this.collageDirectoryError.set(null);
      },
      error: (error) => {
        console.error('Error loading available layouts:', error);
        // Fallback to just Einzelbild if there's an error
        this.layouts.set(['Einzelbild']);
        this.collageDirectoryError.set(
          'Fehler beim Laden der Collage-Vorlagen',
        );
      },
    });
  }

  startFotobox(): void {
    console.log('Starting Fotobox - saving settings and initializing camera');

    // Save settings first
    this.saveSettings();

    // Mark that we're initializing
    this.isInitializingCamera.set(true);

    // Initialize camera with selected driver
    this.initializeCameraAndWaitForLoading();
  }

  private initializeCameraAndWaitForLoading(): void {
    // Load available cameras and status
    this.cameraStore.loadAvailableCameras();
    this.cameraStore.loadCameraStatus();

    // Get the selected camera driver from the form
    const selectedCamera = this.settingsForm.get('camera')?.value;
    console.log('[Settings] Selected camera from form:', selectedCamera);

    const currentCamera = this.cameraStore.currentCamera();
    console.log('[Settings] Current camera status:', currentCamera);

    if (
      !currentCamera ||
      currentCamera.driver === 'none' ||
      !currentCamera.available
    ) {
      const driverToInit = selectedCamera || 'demo';
      console.log(
        '[Settings] No camera initialized, initializing:',
        driverToInit,
      );

      // Initialize the camera
      this.cameraStore.initializeCamera(driverToInit);

      // Watch for camera initialization completion using observables
      this.watchForCameraInitialization(driverToInit);
    } else {
      console.log(
        '[Settings] Camera already initialized:',
        currentCamera.driver,
      );

      // Check if live view is active, if not start it
      const isLiveViewActive = this.cameraStore.isLiveViewActive();
      if (!isLiveViewActive) {
        console.log('[Settings] Starting live view with existing camera');
        this.cameraStore.startLiveView();
      }

      // Navigate to home
      this.navigateToHome();
    }
  }

  private watchForCameraInitialization(driverToInit: string): void {
    this.camera$
      .pipe(
        filter(({ isLoading, currentCamera }) => {
          const isReady =
            !isLoading &&
            currentCamera &&
            currentCamera.driver === driverToInit &&
            currentCamera.available;

          if (isReady) {
            console.log(
              '[Settings] Camera initialized successfully:',
              currentCamera,
            );
          }

          return !!isReady;
        }),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        // Start live view
        console.log(
          '[Settings] Starting live view after camera initialization',
        );
        this.cameraStore.startLiveView();

        // Navigate to home
        this.navigateToHome();
      });
  }

  private navigateToHome(): void {
    this.isInitializingCamera.set(false);
    console.log('[Settings] Navigating to home');
    this.router.navigate(['/home']).catch((err) => {
      console.error('Navigation to home failed:', err);
    });
  }

  saveSettings(): void {
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
      if (result && typeof result === 'object' && 'filePaths' in result) {
        const dialogResult = result as {
          canceled: boolean;
          filePaths: string[];
        };
        if (!dialogResult.canceled && dialogResult.filePaths.length > 0) {
          const selectedPath = dialogResult.filePaths[0];
          this.settingsForm.patchValue({ [fieldName]: selectedPath });
        }
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
