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

@Component({
  selector: 'app-collage-layout',
  standalone: true,
  imports: [
    CommonModule,
    CameraLiveViewComponent,
    CountdownComponent,
    PhotoViewComponent,
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

  private templateId = 'Collage';
  private collageDirectory?: string;

  /** True while we expect a freshly captured photo to arrive in the store. */
  private awaitingPicture = false;
  private lastProcessedPath: string | null = null;

  readonly showPrint = computed(() => this.usePrinter());

  readonly isCollageComplete = computed(
    () => this.photos().length >= this.requiredPhotos(),
  );

  readonly topMessage = computed(() => {
    if (this.building()) {
      return 'Collage wird erstellt...';
    }
    const taken = this.photos().length;
    const total = this.requiredPhotos();
    if (taken >= total) {
      return 'Collage wird erstellt...';
    }
    const next = taken + 1;
    if (this.previewSrc() && !this.capturing()) {
      return `Foto ${next} von ${total} aufgenommen - Berühren für nächstes Foto`;
    }
    return `Foto ${next} von ${total} - Berühren um Foto zu machen`;
  });

  constructor() {
    // Process each freshly captured photo as it arrives in the store.
    effect(() => {
      const picture = this.cameraStore.lastPicture();
      if (
        picture &&
        this.awaitingPicture &&
        picture.path !== this.lastProcessedPath
      ) {
        this.lastProcessedPath = picture.path;
        this.awaitingPicture = false;
        this.onPhotoCaptured(picture.path);
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
      });

    // Start a fresh collage on the backend, then load the initial preview
    // (shows the template with questionmark placeholders in all slots).
    this.collageService.startCollage(this.templateId).subscribe({
      next: () => this.loadCollagePreview(),
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

  private shutterTimeout(): number {
    return this.readSetting<number>('shutterTimeout') ?? 3;
  }

  takePicture(): void {
    if (
      this.collagePhoto() ||
      this.building() ||
      this.capturing() ||
      this.countdownRef()?.isRunning ||
      this.isCollageComplete()
    ) {
      return;
    }
    this.countdownRef()?.start(this.shutterTimeout());
  }

  onCountdownComplete(): void {
    this.capturing.set(true);
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

  private onPhotoCaptured(path: string): void {
    this.capturing.set(false);

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
    });
  }

  private loadCollagePreview(): void {
    this.collageService.getCollagePreview().subscribe({
      next: (src) => {
        if (src) {
          this.previewSrc.set(src);
        }
      },
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
      },
    });
  }

  get isOnlyLayoutActive(): boolean {
    const layouts = this.settingsStore.activeLayouts();
    return layouts.length === 1 && layouts[0] === 'Collage';
  }

  print(): void {
    // Printing is wired in Phase 4; for now return home.
    this.exitToHome();
  }

  private reset(): void {
    this.countdownRef()?.abort();
    this.photos.set([]);
    this.previewSrc.set(null);
    this.collagePhoto.set(null);
    this.capturing.set(false);
    this.building.set(false);
    this.awaitingPicture = false;
  }

  exitToHome(): void {
    this.collageService.resetCollage().subscribe();
    this.reset();
    this.router.navigate(['/home']);
  }
}
