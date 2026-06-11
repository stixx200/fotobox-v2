import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SettingsStore, CameraStore } from '../store';
import { CollageService } from '../services/collage.service';
import { CameraLiveViewComponent } from '../components/camera-live-view/camera-live-view.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    RouterModule,
    CameraLiveViewComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly settingsStore = inject(SettingsStore);
  private readonly collageService = inject(CollageService);
  private readonly router = inject(Router);
  private readonly cameraStore = inject(CameraStore);

  private readonly ESCAPE_TAPS_REQUIRED = 5;
  private escapeTimer: ReturnType<typeof setTimeout> | null = null;
  readonly escapeTapCount = signal(0);

  onEscapeTap(): void {
    const next = this.escapeTapCount() + 1;
    this.escapeTapCount.set(next);

    // Reset counter after 3 seconds of inactivity.
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
    }
    this.escapeTimer = setTimeout(() => {
      this.escapeTapCount.set(0);
    }, 3000);

    if (next >= this.ESCAPE_TAPS_REQUIRED) {
      clearTimeout(this.escapeTimer!);
      this.escapeTimer = null;
      this.escapeTapCount.set(0);
      this.router.navigate(['/settings']);
    }
  }

  ngOnDestroy(): void {
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
    }
  }

  // Get active layouts from settings
  readonly settings = this.settingsStore.settings;

  // Store for layout preview URLs
  readonly layoutPreviews = signal<Map<string, string>>(new Map());

  readonly activeLayouts = computed(() => {
    const settingsArray = this.settings();
    const layoutsSetting = settingsArray.find((s) => s.key === 'layouts');
    if (layoutsSetting) {
      try {
        return JSON.parse(layoutsSetting.value) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });

  readonly isSingleLayoutActive = computed(() => {
    return this.activeLayouts().includes('Einzelbild');
  });

  readonly isCollageLayoutActive = computed(() => {
    return this.activeLayouts().includes('Collage');
  });

  constructor() {
    // Watch for changes in active layouts and load previews
    effect(() => {
      const layouts = this.activeLayouts();
      if (layouts.length > 0) {
        this.loadLayoutPreviews();
      }
    });
  }

  ngOnInit() {
    // Check if camera is loaded, redirect to settings if not
    this.validateCameraAndRedirect();

    // Auto-navigate to layout if only one is active
    const layouts = this.activeLayouts();
    if (layouts.length === 1) {
      this.navigateToLayout(layouts[0]);
    }
  }

  private validateCameraAndRedirect(): void {
    const currentCamera = this.cameraStore.currentCamera();
    if (
      !currentCamera ||
      currentCamera.driver === 'none' ||
      !currentCamera.available
    ) {
      console.warn('[HomeComponent] No camera loaded, redirecting to settings');
      this.router.navigate(['/settings']).catch((err) => {
        console.error('Navigation to settings failed:', err);
      });
    }
  }

  private loadLayoutPreviews() {
    const layouts = this.activeLayouts();
    const collageDirectorySetting = this.settings().find(
      (s) => s.key === 'collageDirectory',
    );
    const collageDirectory = collageDirectorySetting
      ? JSON.parse(collageDirectorySetting.value)
      : undefined;

    const existingPreviews = this.layoutPreviews();

    layouts.forEach((layout) => {
      // Skip if preview already loaded
      if (existingPreviews.has(layout)) {
        return;
      }

      this.collageService.getLayoutPreview(layout, collageDirectory).subscribe({
        next: (previewUrl) => {
          this.layoutPreviews.update((previews) => {
            const newMap = new Map(previews);
            newMap.set(layout, previewUrl);
            return newMap;
          });
        },
        error: (error) => {
          console.error(`Error loading preview for ${layout}:`, error);
        },
      });
    });
  }

  navigateToLayout(layout: string) {
    if (layout === 'Einzelbild') {
      this.router.navigate(['/layouts/single']);
    } else {
      // For custom collages, navigate to collage layout
      this.router.navigate(['/layouts/collage'], {
        queryParams: { template: layout },
      });
    }
  }

  getLayoutIcon(layout: string): string {
    return layout === 'Einzelbild' ? 'image' : 'collage';
  }

  getLayoutDescription(layout: string): string {
    return layout === 'Einzelbild' ? 'Einzelnes Foto' : layout;
  }

  getLayoutPreview(layout: string): string | null {
    return this.layoutPreviews().get(layout) || null;
  }
}
