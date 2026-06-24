import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsStore } from '../store';

@Injectable({ providedIn: 'root' })
export class LayoutNavigationService {
  private readonly router = inject(Router);
  private readonly settingsStore = inject(SettingsStore);

  activeLayouts(): string[] {
    return this.settingsStore.activeLayouts();
  }

  hasSingleLayoutOnly(): boolean {
    return this.activeLayouts().length === 1;
  }

  navigateToLayout(layout: string): Promise<boolean> {
    if (layout === 'Einzelbild') {
      return this.router.navigate(['/layouts/single']);
    }

    return this.router.navigate(['/layouts/collage'], {
      queryParams: { template: layout },
    });
  }

  /** Home when multiple layouts are active; otherwise straight into the only layout. */
  navigateToEntryPoint(): Promise<boolean> {
    const layouts = this.activeLayouts();
    if (layouts.length === 1) {
      return this.navigateToLayout(layouts[0]);
    }
    return this.router.navigate(['/home']);
  }
}
