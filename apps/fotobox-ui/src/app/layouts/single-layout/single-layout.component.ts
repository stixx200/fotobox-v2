import {
  Component,
  inject,
  OnInit,
  effect,
  signal,
  computed,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SettingsStore, CameraStore } from '../../store';
import { TranslatePipe } from '@ngx-translate/core';
import { CameraLiveViewComponent } from '../../components/camera-live-view/camera-live-view.component';
import { CountdownComponent } from '../../components/countdown/countdown.component';
import { PhotoViewComponent } from '../../components/photo-view/photo-view.component';
import { getPhotoUrl } from '../../api-config';
import { PhotoActionsService } from '../../services/photo-actions.service';
import { LayoutNavigationService } from '../../services/layout-navigation.service';
import { SettingsEscapeZoneComponent } from '../../components/settings-escape-zone/settings-escape-zone.component';
import { ShareQrOverlayComponent } from '../../components/share-qr-overlay/share-qr-overlay.component';
import { GalleryAccessService } from '../../services/gallery-access.service';
import { CaptureWatchdogService } from '../../services/capture-watchdog.service';

@Component({
  selector: 'app-single-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CameraLiveViewComponent,
    CountdownComponent,
    PhotoViewComponent,
    TranslatePipe,
    SettingsEscapeZoneComponent,
    ShareQrOverlayComponent,
  ],
  providers: [PhotoActionsService],
  templateUrl: './single-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './single-layout.component.scss',
})
export class SingleLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly settingsStore = inject(SettingsStore);
  private readonly cameraStore = inject(CameraStore);
  readonly actions = inject(PhotoActionsService);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly galleryAccess = inject(GalleryAccessService);
  private readonly captureWatchdog = inject(CaptureWatchdogService);

  private readonly liveView = viewChild(CameraLiveViewComponent);
  private readonly countdownRef = viewChild(CountdownComponent);

  readonly photo = signal<string | null>(null);
  readonly capturing = signal(false);
  readonly flashing = signal(false);

  /** True while we expect a freshly captured photo to arrive in the store. */
  private awaitingPicture = false;
  private lastProcessedPictureId: string | null = null;
  private cancelCaptureWatch: (() => void) | null = null;

  readonly showPrint = computed(() => this.usePrinter());
  readonly showShare = computed(() => this.useShare());
  readonly showGalleryButton = computed(() => {
    this.settingsStore.settings();
    return this.galleryAccess.isGalleryEnabled();
  });

  constructor() {
    // Display the photo once a freshly captured one arrives in the store.
    effect(() => {
      const lastPicture = this.cameraStore.lastPicture();
      if (
        lastPicture &&
        this.awaitingPicture &&
        lastPicture.id !== this.lastProcessedPictureId
      ) {
        this.lastProcessedPictureId = lastPicture.id;
        this.awaitingPicture = false;
        this.capturing.set(false);
        this.stopCaptureWatch();
        this.captureWatchdog.onCaptureSuccess();
        this.photo.set(getPhotoUrl(lastPicture.path));
      }
    });
  }

  ngOnInit(): void {
    this.validateCameraAndRedirect();
  }

  private validateCameraAndRedirect(): void {
    const currentCamera = this.cameraStore.currentCamera();
    if (
      !currentCamera ||
      currentCamera.driver === 'none' ||
      !currentCamera.available
    ) {
      this.router.navigate(['/settings']);
    }
  }

  private usePrinter(): boolean {
    return this.readBooleanSetting('usePrinter', true);
  }

  private useShare(): boolean {
    return this.readBooleanSetting('useShare', false);
  }

  private readBooleanSetting(key: string, defaultValue: boolean): boolean {
    const setting = this.settingsStore.settings().find((s) => s.key === key);
    if (!setting) {
      return defaultValue;
    }
    try {
      return JSON.parse(setting.value) === true;
    } catch {
      return defaultValue;
    }
  }

  private shutterTimeout(): number {
    const setting = this.settingsStore
      .settings()
      .find((s) => s.key === 'shutterTimeout');
    if (!setting) {
      return 3;
    }
    try {
      return JSON.parse(setting.value);
    } catch {
      return 3;
    }
  }

  /**
   * Keyboard equivalent of tapping the screen. Only reacts when the container
   * itself is focused so that Enter/Space on nested buttons keeps its own
   * meaning.
   */
  onContainerKeydown(event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    this.takePicture();
  }

  takePicture(): void {
    if (this.photo() || this.countdownRef()?.isRunning || this.capturing()) {
      return; // Already showing a photo or counting down.
    }
    this.countdownRef()?.start(this.shutterTimeout());
  }

  onCountdownComplete(): void {
    this.capturing.set(true);
    this.flashing.set(true);
    setTimeout(() => this.flashing.set(false), 420);
    this.awaitingPicture = true;
    this.startCaptureWatch();

    if (this.cameraStore.isClientCamera()) {
      const frame = this.liveView()?.captureFrame();
      if (frame) {
        this.cameraStore.uploadPhoto(frame);
      } else {
        this.recoverFromCaptureFailure();
      }
    } else {
      this.cameraStore.takePicture();
    }
  }

  private startCaptureWatch(): void {
    this.stopCaptureWatch();
    this.cancelCaptureWatch = this.captureWatchdog.start(() =>
      this.recoverFromCaptureFailure(),
    );
  }

  private stopCaptureWatch(): void {
    this.cancelCaptureWatch?.();
    this.cancelCaptureWatch = null;
  }

  private recoverFromCaptureFailure(): void {
    if (!this.awaitingPicture) {
      return;
    }
    this.awaitingPicture = false;
    this.capturing.set(false);
    this.stopCaptureWatch();
  }

  /** Live view is waiting for a tap (no countdown, capture or photo). */
  isIdle(): boolean {
    return (
      !this.photo() && !this.capturing() && !this.countdownRef()?.isRunning
    );
  }

  get isOnlyLayoutActive(): boolean {
    return this.layoutNavigation.hasSingleLayoutOnly();
  }

  goToGallery(): void {
    void this.router.navigate(['/gallery']);
  }

  async print(): Promise<void> {
    if (await this.actions.print(this.photo())) {
      this.onPhotoDismissed();
    }
  }

  share(): void {
    this.actions.share(this.photo());
  }

  onPhotoDismissed(): void {
    if (this.isOnlyLayoutActive) {
      this.backToLiveView();
    } else {
      this.exitToHome();
    }
  }

  backToLiveView(): void {
    this.actions.closeShare();
    this.countdownRef()?.abort();
    this.recoverFromCaptureFailure();
    this.photo.set(null);
  }

  exitToHome(): void {
    this.countdownRef()?.abort();
    this.recoverFromCaptureFailure();
    this.photo.set(null);
    void this.layoutNavigation.navigateToEntryPoint();
  }
}
