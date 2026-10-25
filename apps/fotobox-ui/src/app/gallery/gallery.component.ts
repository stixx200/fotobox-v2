import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GalleryService, PhotoInfo } from '../services/gallery.service';
import { GalleryAccessService } from '../services/gallery-access.service';
import { LayoutNavigationService } from '../services/layout-navigation.service';
import { NotificationService } from '../services/notification.service';
import { PhotoActionsService } from '../services/photo-actions.service';
import { ClientLogService } from '../services/client-log.service';
import { SettingsStore } from '../store';
import { ShareQrOverlayComponent } from '../components/share-qr-overlay/share-qr-overlay.component';
import { PinPadComponent } from '../components/pin-pad/pin-pad.component';
import { getPhotoUrl } from '../api-config';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    ShareQrOverlayComponent,
    PinPadComponent,
  ],
  providers: [PhotoActionsService],
  templateUrl: './gallery.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnDestroy {
  private readonly galleryService = inject(GalleryService);
  private readonly galleryAccess = inject(GalleryAccessService);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly clientLog = inject(ClientLogService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  readonly actions = inject(PhotoActionsService);

  readonly unlocked = this.galleryAccess.unlocked;
  readonly pinError = signal(false);
  readonly requiresPassword = computed(() =>
    this.galleryAccess.requiresPassword(),
  );

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly photos = signal<PhotoInfo[]>([]);
  readonly selected = signal<PhotoInfo | null>(null);
  readonly deleteConfirmPending = signal(false);
  readonly deleting = signal(false);
  /** Photos whose file could not be loaded (listed but missing on disk). */
  readonly brokenIds = signal<ReadonlySet<string>>(new Set());
  private photosLoaded = false;

  readonly showPrint = computed(() => {
    const setting = this.settingsStore
      .settings()
      .find((s) => s.key === 'usePrinter');
    if (!setting) return true;
    try {
      return JSON.parse(setting.value) !== false;
    } catch {
      return true;
    }
  });

  readonly showShare = computed(() => {
    const setting = this.settingsStore
      .settings()
      .find((s) => s.key === 'useShare');
    if (!setting) return false;
    try {
      return JSON.parse(setting.value) === true;
    } catch {
      return false;
    }
  });

  readonly selectedUrl = computed(() => {
    const p = this.selected();
    return p ? getPhotoUrl(p.path) : null;
  });

  constructor() {
    if (!this.galleryAccess.isGalleryEnabled()) {
      void this.layoutNavigation.navigateToEntryPoint();
      return;
    }

    if (!this.requiresPassword()) {
      this.galleryAccess.unlock();
      this.loadPhotos();
    } else if (this.unlocked()) {
      this.loadPhotos();
    }
  }

  ngOnDestroy(): void {
    this.galleryAccess.lock();
  }

  /** Called by the keypad once all digits are entered. */
  submitPin(pin: string): void {
    if (this.galleryAccess.validate(pin)) {
      this.pinError.set(false);
      this.galleryAccess.unlock();
      this.loadPhotos();
      return;
    }

    this.pinError.set(true);
  }

  private loadPhotos(): void {
    if (this.photosLoaded) {
      return;
    }
    this.photosLoaded = true;
    this.loading.set(true);
    this.loadError.set(false);
    this.galleryService.listPhotos().subscribe({
      next: (photos) => {
        this.photos.set(photos);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.clientLog.error('Gallery: loading photos failed', error);
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  reload(): void {
    this.photosLoaded = false;
    this.brokenIds.set(new Set());
    this.loadPhotos();
  }

  markBroken(photo: PhotoInfo): void {
    this.brokenIds.update((ids) => new Set(ids).add(photo.id));
  }

  photoUrl(photo: PhotoInfo): string {
    return getPhotoUrl(photo.path);
  }

  select(photo: PhotoInfo): void {
    this.deleteConfirmPending.set(false);
    this.selected.set(photo);
  }

  /** Close the detail view only when the dimmed backdrop itself is tapped. */
  onDetailBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeDetail();
    }
  }

  closeDetail(): void {
    this.deleteConfirmPending.set(false);
    this.actions.closeShare();
    this.selected.set(null);
  }

  requestDelete(): void {
    this.deleteConfirmPending.set(true);
  }

  cancelDelete(): void {
    this.deleteConfirmPending.set(false);
  }

  async print(): Promise<void> {
    if (await this.actions.print(this.selectedUrl())) {
      this.closeDetail();
    }
  }

  share(): void {
    this.actions.share(this.selectedUrl());
  }

  confirmDelete(): void {
    const photo = this.selected();
    if (!photo || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.galleryService.deletePhoto(photo.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteConfirmPending.set(false);
        this.selected.set(null);
        this.photos.update((list) => list.filter((p) => p.id !== photo.id));
        this.notificationService.success(
          this.translateService.instant('GALLERY.DELETED'),
        );
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.clientLog.error('Gallery: deleting photo failed', error);
        this.notificationService.error(
          this.translateService.instant('GALLERY.DELETE_ERROR'),
        );
      },
    });
  }

  goBack(): void {
    void this.layoutNavigation.navigateToEntryPoint();
  }
}
