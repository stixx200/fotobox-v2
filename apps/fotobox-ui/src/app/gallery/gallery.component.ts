import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GalleryService, PhotoInfo } from '../services/gallery.service';
import { PrintService } from '../services/print.service';
import { getPhotoUrl } from '../api-config';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent {
  private readonly galleryService = inject(GalleryService);
  private readonly printService = inject(PrintService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly photos = signal<PhotoInfo[]>([]);
  readonly selected = signal<PhotoInfo | null>(null);

  readonly selectedUrl = computed(() => {
    const p = this.selected();
    return p ? getPhotoUrl(p.path) : null;
  });

  constructor() {
    this.loadPhotos();
  }

  private loadPhotos(): void {
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
    this.selected.set(photo);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  print(): void {
    const url = this.selectedUrl();
    if (url) {
      this.printService.printPhoto(url);
    }
  }

  deleteSelected(): void {
    const photo = this.selected();
    if (!photo) return;
    this.galleryService.deletePhoto(photo.id).subscribe({
      next: () => {
        this.selected.set(null);
        this.photos.update((list) => list.filter((p) => p.id !== photo.id));
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
