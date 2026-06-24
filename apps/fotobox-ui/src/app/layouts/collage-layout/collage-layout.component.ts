import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  effect,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SettingsStore, CameraStore } from '../../store';
import { CameraLiveViewComponent } from '../../components/camera-live-view/camera-live-view.component';
import { CountdownComponent } from '../../components/countdown/countdown.component';
import { PhotoViewComponent } from '../../components/photo-view/photo-view.component';
import { CollageService } from '../../services/collage.service';
import { getPhotoUrl } from '../../api-config';
import { PrintService } from '../../services/print.service';
import { ShareService, ShareLink } from '../../services/share.service';
import { NotificationService } from '../../services/notification.service';
import { LayoutNavigationService } from '../../services/layout-navigation.service';
import { ShareQrOverlayComponent } from '../../components/share-qr-overlay/share-qr-overlay.component';
import { GalleryAccessService } from '../../services/gallery-access.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { SettingsEscapeZoneComponent } from '../../components/settings-escape-zone/settings-escape-zone.component';
import { CaptureWatchdogService } from '../../services/capture-watchdog.service';
import { RecoveryService } from '../../services/recovery.service';

interface ReviewPhoto {
  url: string;
  path: string;
}

@Component({
  selector: 'app-collage-layout',
  standalone: true,
  imports: [
    CommonModule,
    CameraLiveViewComponent,
    CountdownComponent,
    PhotoViewComponent,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    SettingsEscapeZoneComponent,
    ShareQrOverlayComponent,
  ],
  templateUrl: './collage-layout.component.html',
  styleUrl: './collage-layout.component.scss',
})
export class CollageLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly settingsStore = inject(SettingsStore);
  private readonly cameraStore = inject(CameraStore);
  private readonly collageService = inject(CollageService);
  private readonly printService = inject(PrintService);
  private readonly shareService = inject(ShareService);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly translateService = inject(TranslateService);
  private readonly galleryAccess = inject(GalleryAccessService);
  private readonly captureWatchdog = inject(CaptureWatchdogService);
  private readonly recovery = inject(RecoveryService);

  private readonly liveView = viewChild(CameraLiveViewComponent);
  private readonly countdownRef = viewChild(CountdownComponent);

  /** Display URLs of the photos captured so far (kept for count / isCollageComplete). */
  readonly photos = signal<string[]>([]);
  readonly requiredPhotos = signal<number>(4);
  /** Base64 data-URL of the partial collage rendered by the backend (? placeholders for empty slots). */
  readonly previewSrc = signal<string | null>(null);
  readonly collagePhoto = signal<string | null>(null);
  readonly capturing = signal(false);
  readonly building = signal(false);
  readonly flashing = signal(false);
  /** Photo awaiting user confirmation before it is added to the collage. */
  readonly reviewPhoto = signal<ReviewPhoto | null>(null);

  private templateId = 'Collage';
  private collageDirectory?: string;

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
  readonly activeShareLink = signal<ShareLink | null>(null);

  readonly isCollageComplete = computed(
    () => this.photos().length >= this.requiredPhotos(),
  );

  readonly topMessage = computed(() => {
    if (this.building()) {
      return this.translateService.instant('COLLAGE.BUILDING');
    }
    const taken = this.photos().length;
    const total = this.requiredPhotos();
    if (taken >= total) {
      return this.translateService.instant('COLLAGE.BUILDING');
    }
    const next = taken + 1;
    if (this.reviewPhoto()) {
      return this.translateService.instant('COLLAGE.USE_PHOTO');
    }
    if (total === 1) {
      return '';
    }
    if (this.previewSrc() && !this.capturing()) {
      return this.translateService.instant('COLLAGE.PHOTO_TAKEN', {
        next,
        total,
      });
    }
    return this.translateService.instant('COLLAGE.PHOTO_PROMPT', {
      next,
      total,
    });
  });

  constructor() {
    // Process each freshly captured photo as it arrives in the store.
    effect(() => {
      const picture = this.cameraStore.lastPicture();
      if (
        picture &&
        this.awaitingPicture &&
        picture.id !== this.lastProcessedPictureId
      ) {
        this.lastProcessedPictureId = picture.id;
        this.awaitingPicture = false;
        this.capturing.set(false);
        this.stopCaptureWatch();
        this.captureWatchdog.onCaptureSuccess();
        if (this.requiredPhotos() === 1) {
          this.onPhotoCaptured(picture.path);
        } else {
          this.reviewPhoto.set({
            url: getPhotoUrl(picture.path),
            path: picture.path,
          });
        }
      }
    });
  }

  ngOnInit(): void {
    if (!this.validateCamera()) {
      return;
    }

    this.templateId =
      this.route.snapshot.queryParamMap.get('template') ?? 'Collage';
    this.collageDirectory = this.readSetting<string>('collageDirectory');

    // Resolve how many photos this template needs.
    this.collageService
      .getRequiredPhotoCount(this.templateId, this.collageDirectory)
      .subscribe({
        next: (count) => {
          if (count > 0) {
            this.requiredPhotos.set(count);
          }
        },
        error: () =>
          this.notificationService.error(
            this.translateService.instant('COLLAGE.LOAD_ERROR'),
          ),
      });

    // Start a fresh collage on the backend, then load the initial preview
    // (shows the template with questionmark placeholders in all slots).
    this.collageService.startCollage(this.templateId).subscribe({
      next: () => this.loadCollagePreview(),
      error: () => {
        this.notificationService.error(
          this.translateService.instant('COLLAGE.START_ERROR'),
        );
        this.recovery.navigateToSettings();
      },
    });
  }

  ngOnDestroy(): void {
    this.countdownRef()?.abort();
  }

  private validateCamera(): boolean {
    const currentCamera = this.cameraStore.currentCamera();
    if (
      !currentCamera ||
      currentCamera.driver === 'none' ||
      !currentCamera.available
    ) {
      this.router.navigate(['/settings']);
      return false;
    }
    return true;
  }

  private readSetting<T>(key: string): T | undefined {
    const setting = this.settingsStore.settings().find((s) => s.key === key);
    if (!setting) {
      return undefined;
    }
    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return undefined;
    }
  }

  private usePrinter(): boolean {
    return this.readSetting<boolean>('usePrinter') !== false;
  }

  private useShare(): boolean {
    return this.readSetting<boolean>('useShare') === true;
  }

  private shutterTimeout(): number {
    return this.readSetting<number>('shutterTimeout') ?? 3;
  }

  takePicture(): void {
    if (
      this.collagePhoto() ||
      this.building() ||
      this.capturing() ||
      this.reviewPhoto() ||
      this.countdownRef()?.isRunning ||
      this.isCollageComplete()
    ) {
      return;
    }
    this.countdownRef()?.start(this.shutterTimeout());
  }

  acceptReviewedPhoto(): void {
    const photo = this.reviewPhoto();
    if (!photo) {
      return;
    }
    this.reviewPhoto.set(null);
    this.onPhotoCaptured(photo.path);
  }

  rejectReviewedPhoto(): void {
    this.reviewPhoto.set(null);
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

  private onPhotoCaptured(path: string): void {
    // The collage maker expects a filename relative to the photo directory.
    const filename = path.split('/').pop() ?? path;

    // Track the count so isCollageComplete() updates correctly.
    this.photos.update((photos) => [...photos, getPhotoUrl(path)]);

    this.collageService.addPhotoToCollage(filename).subscribe({
      next: () => {
        // Refresh the preview so the user sees the new photo in the template.
        this.loadCollagePreview();
        if (this.isCollageComplete()) {
          this.finalizeCollage();
        }
      },
      error: () => {
        this.photos.update((photos) => photos.slice(0, -1));
        this.notificationService.error(
          this.translateService.instant('COLLAGE.ADD_PHOTO_ERROR'),
        );
      },
    });
  }

  private loadCollagePreview(): void {
    this.collageService.getCollagePreview().subscribe({
      next: (src) => {
        if (src) {
          this.previewSrc.set(src);
        }
      },
      error: () =>
        this.notificationService.error(
          this.translateService.instant('COLLAGE.PREVIEW_ERROR'),
        ),
    });
  }

  private finalizeCollage(): void {
    this.building.set(true);
    this.collageService.finalizeCollage().subscribe({
      next: (result) => {
        this.building.set(false);
        this.collagePhoto.set(getPhotoUrl(result.path));
      },
      error: () => {
        this.building.set(false);
        this.notificationService.error(
          this.translateService.instant('COLLAGE.FINALIZE_ERROR'),
        );
      },
    });
  }

  get isOnlyLayoutActive(): boolean {
    return this.layoutNavigation.hasSingleLayoutOnly();
  }

  goToGallery(): void {
    void this.router.navigate(['/gallery']);
  }

  async print(): Promise<void> {
    const url = this.collagePhoto();
    if (!url) {
      return;
    }
    const success = await this.printService.printPhoto(url);
    if (success) {
      this.exitToHome();
    }
  }

  share(): void {
    const url = this.collagePhoto();
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

  private reset(): void {
    this.countdownRef()?.abort();
    this.photos.set([]);
    this.previewSrc.set(null);
    this.collagePhoto.set(null);
    this.recoverFromCaptureFailure();
    this.building.set(false);
    this.reviewPhoto.set(null);
    this.stopCaptureWatch();
  }

  exitToHome(): void {
    this.collageService.resetCollage().subscribe();
    this.reset();
    void this.layoutNavigation.navigateToEntryPoint();
  }
}
