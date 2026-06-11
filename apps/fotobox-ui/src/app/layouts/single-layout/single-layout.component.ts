import { Component, inject, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettingsStore, CameraStore } from '../../store';
import { CameraLiveViewComponent } from '../../components/camera-live-view/camera-live-view.component';

@Component({
  selector: 'app-single-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    CameraLiveViewComponent,
  ],
  templateUrl: './single-layout.component.html',
  styleUrl: './single-layout.component.scss',
})
export class SingleLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly settingsStore = inject(SettingsStore);
  private readonly cameraStore = inject(CameraStore);

  photo = signal<string | null>(null);
  countdown = signal<number | null>(null);
  countdownInterval: any = null;

  constructor() {
    // Watch for new pictures from the camera store
    effect(() => {
      const lastPicture = this.cameraStore.lastPicture();
      if (lastPicture) {
        // Set the photo path for display
        this.photo.set(lastPicture.path);
      }
    });
  }

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
        '[SingleLayoutComponent] No camera loaded, redirecting to settings',
      );
      this.router.navigate(['/settings']).catch((err) => {
        console.error('Navigation to settings failed:', err);
      });
    }
  }

  takePicture() {
    if (this.photo() || this.countdown() !== null) {
      return; // Already taking a picture or showing one
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
    this.countdown.set(shutterTimeout);
    this.countdownInterval = setInterval(() => {
      if (this.countdown() !== null && this.countdown()! > 0) {
        this.countdown.set(this.countdown()! - 1);
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
    this.countdown.set(null);

    // Call camera API to take actual photo
    this.cameraStore.takePicture();
  }

  abortCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.countdown.set(null);
  }

  get isOnlyLayoutActive(): boolean {
    const layouts = this.settingsStore.activeLayouts();
    return layouts.length === 1 && layouts[0] === 'Einzelbild';
  }

  print() {
    // TODO: Call print API
    console.log('Print photo:', this.photo);
    this.exitToHome();
  }
  backToLiveView() {
    this.abortCountdown();
    this.photo.set(null);
  }
  exitToHome() {
    this.abortCountdown();
    this.photo.set(null);
    this.router.navigate(['/home']);
  }
}
