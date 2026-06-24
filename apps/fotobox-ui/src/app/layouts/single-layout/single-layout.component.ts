import {
  Component,
  inject,
  OnInit,
  effect,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettingsStore, CameraStore } from '../../store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CameraLiveViewComponent } from '../../components/camera-live-view/camera-live-view.component';
import { CountdownComponent } from '../../components/countdown/countdown.component';
import { PhotoViewComponent } from '../../components/photo-view/photo-view.component';
import { getPhotoUrl } from '../../api-config';
import { PrintService } from '../../services/print.service';
import { ShareService, ShareLink } from '../../services/share.service';
import { NotificationService } from '../../services/notification.service';
import { LayoutNavigationService } from '../../services/layout-navigation.service';
import { SettingsEscapeZoneComponent } from '../../components/settings-escape-zone/settings-escape-zone.component';
import { ShareQrOverlayComponent } from '../../components/share-qr-overlay/share-qr-overlay.component';
import { GalleryAccessService } from '../../services/gallery-access.service';

@Component({
  selector: 'app-single-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    CameraLiveViewComponent,
    CountdownComponent,
    PhotoViewComponent,
    TranslatePipe,
    SettingsEscapeZoneComponent,
    ShareQrOverlayComponent,
  ],
  templateUrl: './single-layout.component.html',
  styleUrl: './single-layout.component.scss',
})
export class SingleLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly settingsStore = inject(SettingsStore);
  private readonly cameraStore = inject(CameraStore);
  private readonly printService = inject(PrintService);
  private readonly shareService = inject(ShareService);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly galleryAccess = inject(GalleryAccessService);

  private readonly liveView = viewChild(CameraLiveViewComponent);
  private readonly countdownRef = viewChild(CountdownComponent);

  readonly photo = signal<string | null>(null);
  readonly capturing = signal(false);
  readonly flashing = signal(false);

  /** True while we expect a freshly captured photo to arrive in the store. */
  private awaitingPicture = false;
  private lastProcessedPictureId: string | null = null;

  readonly showPrint = computed(() => this.usePrinter());
  readonly showShare = computed(() => this.useShare());
  readonly showGalleryButton = computed(() => {
    this.settingsStore.settings();
    return this.galleryAccess.isGalleryEnabled();
  });
  readonly activeShareLink = signal<ShareLink | null>(null);

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

    if (this.cameraStore.isClientCamera()) {
      const frame = this.liveView()?.captureFrame();
      if (frame) {
        this.cameraStore.uploadPhoto(frame);
      } else {
        this.awaitingPicture = false;
        this.capturing.set(false);
      }
    } else {
      this.cameraStore.takePicture();
    }
  }

  get isOnlyLayoutActive(): boolean {
    return this.layoutNavigation.hasSingleLayoutOnly();
  }

  goToGallery(): void {
    void this.router.navigate(['/gallery']);
  }

  async print(): Promise<void> {
    const url = this.photo();
    if (!url) {
      return;
    }
    const success = await this.printService.printPhoto(url);
    if (success) {
      this.onPhotoDismissed();
    }
  }

  share(): void {
    const url = this.photo();
    if (!url) {
      return;
    }
    this.shareService.createShareLink(url).subscribe({
      next: (link) => this.activeShareLink.set(link),
      error: () =>
        this.notificationService.error(
          this.translateService.instant('SHARE.ERROR'),
        ),
    });
  }

  closeShare(): void {
    this.activeShareLink.set(null);
  }

  onPhotoDismissed(): void {
    if (this.isOnlyLayoutActive) {
      this.backToLiveView();
    } else {
      this.exitToHome();
    }
  }

  backToLiveView(): void {
    this.countdownRef()?.abort();
    this.capturing.set(false);
    this.photo.set(null);
  }

  exitToHome(): void {
    this.countdownRef()?.abort();
    this.capturing.set(false);
    this.photo.set(null);
    void this.layoutNavigation.navigateToEntryPoint();
  }
}
