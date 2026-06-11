import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Presentational overlay that shows a captured photo (or collage) together with
 * print / back actions. The host decides whether printing is offered and what
 * the back action does.
 */
@Component({
  selector: 'app-photo-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="photo-view">
      <img [src]="src" alt="Aufgenommenes Foto" />

      <div class="photo-actions">
        @if (showPrint) {
          <button mat-raised-button color="primary" (click)="print.emit()">
            <mat-icon>print</mat-icon>
            Drucken
          </button>
        }
        <button mat-raised-button (click)="back.emit()">
          <mat-icon>{{ backIcon }}</mat-icon>
          {{ backLabel }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .photo-view {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #000;
        z-index: 15;
      }

      img {
        max-width: 100%;
        max-height: 85%;
        object-fit: contain;
      }

      .photo-actions {
        display: flex;
        gap: 1.5rem;
        margin-top: 1.5rem;
      }

      .photo-actions button {
        min-width: 12rem;
        min-height: 4rem;
        font-size: 1.25rem;
      }
    `,
  ],
})
export class PhotoViewComponent {
  /** Image source (URL or data URI) to display. */
  @Input({ required: true }) src!: string;

  /** Whether to offer the print button. */
  @Input() showPrint = true;

  /** Label for the secondary (back) button. */
  @Input() backLabel = 'Zurück';

  /** Material icon for the secondary button. */
  @Input() backIcon = 'home';

  @Output() print = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
}
