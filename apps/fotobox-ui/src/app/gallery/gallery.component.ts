import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { GalleryService, PhotoInfo } from '../services/gallery.service';
import { GalleryAccessService } from '../services/gallery-access.service';
import { LayoutNavigationService } from '../services/layout-navigation.service';
import { PrintService } from '../services/print.service';
import { ShareService, ShareLink } from '../services/share.service';
import { NotificationService } from '../services/notification.service';
import { SettingsStore } from '../store';
import { ShareQrOverlayComponent } from '../components/share-qr-overlay/share-qr-overlay.component';
import { TranslateService } from '@ngx-translate/core';
import { getPhotoUrl } from '../api-config';
import { TranslatePipe } from '@ngx-translate/core';
import {
  GALLERY_LENGTH,
  sanitizeGalleryPinInput,
} from '../services/gallery-pin.util';
@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
    ShareQrOverlayComponent,
  ],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnDestroy {
  private readonly galleryService = inject(GalleryService);
  private readonly galleryAccess = inject(GalleryAccessService);
  private readonly printService = inject(PrintService);
  private readonly shareService = inject(ShareService);
  private readonly notificationService = inject(NotificationService);
  private readonly translateService = inject(TranslateService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly layoutNavigation = inject(LayoutNavigationService);

  readonly unlocked = this.galleryAccess.unlocked;
  readonly pinInput = signal('');
  readonly pinError = signal(false);
  readonly pinLength = GALLERY_LENGTH;
  readonly requiresPassword = computed(() =>
    this.galleryAccess.requiresPassword(),
  );

  readonly loading = signal(false);
  readonly photos = signal<PhotoInfo[]>([]);
  readonly selected = signal<PhotoInfo | null>(null);
  readonly deleteConfirmPending = signal(false);
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

  readonly activeShareLink = signal<ShareLink | null>(null);

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

  onPinInput(value: string): void {
    const pin = sanitizeGalleryPinInput(value);
    this.pinInput.set(pin);
    this.pinError.set(false);

    if (pin.length === GALLERY_LENGTH) {
      this.submitPin();
    }
  }

  submitPin(): void {
    this.pinError.set(false);

    if (this.galleryAccess.validate(this.pinInput())) {
      this.pinInput.set('');
      this.galleryAccess.unlock();
      this.loadPhotos();
      return;
    }

    this.pinError.set(true);
    this.pinInput.set('');
  }

  private loadPhotos(): void {
    if (this.photosLoaded) {
      return;
    }
    this.photosLoaded = true;
    this.loading.set(true);
    this.galleryService.listPhotos().subscribe({
      next: (photos) => {
        this.photos.set(photos);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  photoUrl(photo: PhotoInfo): string {
    return getPhotoUrl(photo.path);
  }

  select(photo: PhotoInfo): void {
    this.deleteConfirmPending.set(false);
    this.selected.set(photo);
  }

  closeDetail(): void {
    this.deleteConfirmPending.set(false);
    this.selected.set(null);
  }

  requestDelete(): void {
    this.deleteConfirmPending.set(true);
  }

  cancelDelete(): void {
    this.deleteConfirmPending.set(false);
  }

  async print(): Promise<void> {
    const url = this.selectedUrl();
    if (!url) {
      return;
    }
    const success = await this.printService.printPhoto(url);
    if (success) {
      this.closeDetail();
    }
  }

  share(): void {
    const url = this.selectedUrl();
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

  confirmDelete(): void {
    const photo = this.selected();
    if (!photo) {
      return;
    }
    this.galleryService.deletePhoto(photo.id).subscribe({
      next: () => {
        this.deleteConfirmPending.set(false);
        this.selected.set(null);
        this.photos.update((list) => list.filter((p) => p.id !== photo.id));
      },
    });
  }

  goBack(): void {
    void this.layoutNavigation.navigateToEntryPoint();
  }
}
