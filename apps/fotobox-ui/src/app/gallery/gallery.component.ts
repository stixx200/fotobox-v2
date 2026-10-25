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
import { getPhotoUrl } from '../api-config';
import {
  GALLERY_LENGTH,
  sanitizeGalleryPinInput,
} from '../services/gallery-pin.util';

/** How long the wrong-PIN state (shake + message) stays visible. */
const PIN_ERROR_MS = 1500;

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
  ],
  providers: [PhotoActionsService],
  host: { '(document:keydown)': 'onPinKeydown($event)' },
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
  readonly pinInput = signal('');
  readonly pinError = signal(false);
  readonly pinLength = GALLERY_LENGTH;
  readonly keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  /** One entry per PIN digit: `true` once entered. */
  readonly pinDots = computed(() =>
    Array.from(
      { length: GALLERY_LENGTH },
      (_, i) => i < this.pinInput().length,
    ),
  );
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
  private pinErrorTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (this.pinErrorTimer) {
      clearTimeout(this.pinErrorTimer);
    }
  }

  /** On-screen keypad; submits automatically once all digits are entered. */
  pressDigit(digit: string): void {
    const pin = sanitizeGalleryPinInput(this.pinInput() + digit);
    this.pinInput.set(pin);
    this.pinError.set(false);
    if (pin.length === GALLERY_LENGTH) {
      this.submitPin();
    }
  }

  deleteDigit(): void {
    this.pinInput.update((pin) => pin.slice(0, -1));
    this.pinError.set(false);
  }

  /** Operators may still use a hardware keyboard. */
  onPinKeydown(event: KeyboardEvent): void {
    if (!this.requiresPassword() || this.unlocked()) {
      return;
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.pressDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.deleteDigit();
    } else if (event.key === 'Escape') {
      this.goBack();
    }
  }

  submitPin(): void {
    if (this.galleryAccess.validate(this.pinInput())) {
      this.pinInput.set('');
      this.pinError.set(false);
      this.galleryAccess.unlock();
      this.loadPhotos();
      return;
    }

    this.pinError.set(true);
    this.pinInput.set('');
    if (this.pinErrorTimer) {
      clearTimeout(this.pinErrorTimer);
    }
    this.pinErrorTimer = setTimeout(() => {
      this.pinError.set(false);
      this.pinErrorTimer = null;
    }, PIN_ERROR_MS);
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
