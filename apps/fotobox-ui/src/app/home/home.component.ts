import { Component, OnInit, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SettingsStore, CameraStore } from '../store';
import { CollageService } from '../services/collage.service';
import { LayoutNavigationService } from '../services/layout-navigation.service';
import { CameraLiveViewComponent } from '../components/camera-live-view/camera-live-view.component';
import { SettingsEscapeZoneComponent } from '../components/settings-escape-zone/settings-escape-zone.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    RouterModule,
    CameraLiveViewComponent,
    TranslatePipe,
    SettingsEscapeZoneComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly settingsStore = inject(SettingsStore);
  private readonly collageService = inject(CollageService);
  private readonly router = inject(Router);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly cameraStore = inject(CameraStore);
  private readonly translateService = inject(TranslateService);

  goToGallery(): void {
    this.router.navigate(['/gallery']);
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
    effect(() => {
      const layouts = this.activeLayouts();
      if (layouts.length > 0) {
        this.loadLayoutPreviews();
      }

      // Skip selection when settings load after the home route is already active.
      if (layouts.length === 1 && this.router.url.startsWith('/home')) {
        void this.layoutNavigation.navigateToLayout(layouts[0]);
      }
    });
  }

  ngOnInit() {
    this.validateCameraAndRedirect();
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
    void this.layoutNavigation.navigateToLayout(layout);
  }

  getLayoutIcon(layout: string): string {
    return layout === 'Einzelbild' ? 'image' : 'collage';
  }

  getLayoutDescription(layout: string): string {
    return layout === 'Einzelbild'
      ? this.translateService.instant('HOME.SINGLE_LAYOUT')
      : layout;
  }

  getLayoutPreview(layout: string): string | null {
    return this.layoutPreviews().get(layout) || null;
  }
}
