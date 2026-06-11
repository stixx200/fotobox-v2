import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettingsStore, CameraStore } from '../../store';
import { CameraLiveViewComponent } from '../../components/camera-live-view/camera-live-view.component';

@Component({
  selector: 'app-collage-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    CameraLiveViewComponent,
  ],
  templateUrl: './collage-layout.component.html',
  styleUrl: './collage-layout.component.scss',
})
export class CollageLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly settingsStore = inject(SettingsStore);
  private readonly cameraStore = inject(CameraStore);

  photos: string[] = [];
  collagePhoto: string | null = null;
  countdown: number | null = null;
  countdownInterval: any = null;
  currentPhotoIndex = 0;
  totalPhotos = 4; // Default number of photos for collage

  ngOnInit(): void {
    // Check if camera is loaded, redirect to settings if not
    this.validateCameraAndRedirect();
  }

  private validateCameraAndRedirect(): void {
    const currentCamera = this.cameraStore.currentCamera();
    if (
      !currentCamera ||
      currentCamera.driver === 'none' ||
      !currentCamera.available
    ) {
      console.warn(
        '[CollageLayoutComponent] No camera loaded, redirecting to settings',
      );
      this.router.navigate(['/settings']).catch((err) => {
        console.error('Navigation to settings failed:', err);
      });
    }
  }

  get currentPhoto(): string | null {
    if (this.photos.length > 0 && this.currentPhotoIndex < this.photos.length) {
      return this.photos[this.currentPhotoIndex];
    }
    return null;
  }

  get isCollageComplete(): boolean {
    return this.photos.length >= this.totalPhotos;
  }

  get emptySlots(): number[] {
    const remaining = this.totalPhotos - this.photos.length;
    return Array(remaining)
      .fill(0)
      .map((_, i) => i);
  }

  get topMessage(): string {
    if (this.isCollageComplete) {
      return 'Collage wird erstellt...';
    }
    return `Foto ${this.photos.length + 1} von ${this.totalPhotos} - Berühren um Foto zu machen`;
  }

  takePicture() {
    if (
      this.collagePhoto ||
      this.countdown !== null ||
      this.isCollageComplete
    ) {
      return; // Already showing collage or taking a picture
    }

    // Get shutter timeout from settings
    const settings = this.settingsStore.settings();
    const shutterTimeoutSetting = settings.find(
      (s) => s.key === 'shutterTimeout',
    );
    const shutterTimeout = shutterTimeoutSetting
      ? JSON.parse(shutterTimeoutSetting.value)
      : 3;

    // Start countdown
    this.countdown = shutterTimeout;
    this.countdownInterval = setInterval(() => {
      if (this.countdown !== null && this.countdown > 0) {
        this.countdown--;
      } else {
        this.finishCountdown();
      }
    }, 1000);
  }

  finishCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.countdown = null;

    // TODO: Call camera API to take actual photo
    // For now, simulate a photo
    this.photos.push(`/singlelayout.preview.jpg`);

    if (this.isCollageComplete) {
      // Create collage after delay
      setTimeout(() => {
        this.createCollage();
      }, 1000);
    }
  }

  createCollage() {
    // TODO: Call collage maker API
    this.collagePhoto = '/collagelayout.preview.jpg';
  }

  abortCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.countdown = null;
  }

  get isOnlyLayoutActive(): boolean {
    const layouts = this.settingsStore.activeLayouts();
    return layouts.length === 1 && layouts[0] === 'Collage';
  }

  reset() {
    this.abortCountdown();
    this.photos = [];
    this.collagePhoto = null;
    this.currentPhotoIndex = 0;
  }

  print() {
    // TODO: Call print API
    console.log('Print collage:', this.collagePhoto);
    this.exitToHome();
  }

  exitToHome() {
    this.reset();
    this.router.navigate(['/home']);
  }
}
