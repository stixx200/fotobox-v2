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
import { TranslatePipe } from '@ngx-translate/core';
import { CameraLiveViewComponent } from '../../components/camera-live-view/camera-live-view.component';
import { CountdownComponent } from '../../components/countdown/countdown.component';
import { PhotoViewComponent } from '../../components/photo-view/photo-view.component';
import { getPhotoUrl } from '../../api-config';
import { PrintService } from '../../services/print.service';
import { LayoutNavigationService } from '../../services/layout-navigation.service';
import { SettingsEscapeZoneComponent } from '../../components/settings-escape-zone/settings-escape-zone.component';

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
  ],
  templateUrl: './single-layout.component.html',
  styleUrl: './single-layout.component.scss',
})
export class SingleLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly settingsStore = inject(SettingsStore);
  private readonly cameraStore = inject(CameraStore);
  private readonly printService = inject(PrintService);
  private readonly layoutNavigation = inject(LayoutNavigationService);

  private readonly liveView = viewChild(CameraLiveViewComponent);
  private readonly countdownRef = viewChild(CountdownComponent);

  readonly photo = signal<string | null>(null);
  readonly capturing = signal(false);
  readonly flashing = signal(false);

  /** True while we expect a freshly captured photo to arrive in the store. */
  private awaitingPicture = false;
  private lastProcessedPictureId: string | null = null;

  readonly showPrint = computed(() => this.usePrinter());

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
    const setting = this.settingsStore
      .settings()
      .find((s) => s.key === 'usePrinter');
    if (!setting) {
      return true;
    }
    try {
      return JSON.parse(setting.value) !== false;
    } catch {
      return true;
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

  print(): void {
    const url = this.photo();
    if (url) {
      this.printService.printPhoto(url);
    }
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
