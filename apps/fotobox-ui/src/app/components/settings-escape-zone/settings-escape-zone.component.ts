import { Component, inject } from '@angular/core';
import { SettingsEscapeService } from '../../services/settings-escape.service';

@Component({
  selector: 'app-settings-escape-zone',
  standalone: true,
  template: `
    <div
      class="escape-zone"
      (click)="onClick($event)"
      [attr.data-taps]="escape.tapCount() || null"
      aria-hidden="true"
    ></div>
  `,
  styles: [
    `
      .escape-zone {
        position: absolute;
        top: 0;
        left: 0;
        width: 80px;
        height: 80px;
        z-index: 30;
        cursor: default;
        -webkit-tap-highlight-color: transparent;
      }
    `,
  ],
})
export class SettingsEscapeZoneComponent {
  readonly escape = inject(SettingsEscapeService);

  onClick(event: Event): void {
    event.stopPropagation();
    this.escape.onTap();
  }
}
