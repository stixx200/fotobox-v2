import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DirectoryBrowserService,
  DirectoryListing,
} from '../../services/directory-browser.service';

export interface DirectoryPickerData {
  title: string;
  /** Folder to start in; the host's home directory when empty. */
  initialPath?: string | null;
}

/**
 * Folder picker that browses the host's filesystem through the API, so it
 * works in any browser and on tablets. Closes with the chosen path, or
 * `undefined` when cancelled.
 */
@Component({
  selector: 'app-directory-picker-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content class="picker">
      <div class="picker__roots">
        @for (root of listing()?.roots ?? []; track root) {
          <button
            mat-stroked-button
            type="button"
            class="picker__root"
            (click)="open(root)"
          >
            <mat-icon>{{ $first ? 'home' : 'storage' }}</mat-icon>
            {{ root }}
          </button>
        }
      </div>

      <div class="picker__current">
        <button
          mat-icon-button
          type="button"
          [disabled]="!listing()?.parent"
          [attr.aria-label]="'DIRECTORY_PICKER.UP' | translate"
          (click)="open(listing()?.parent)"
        >
          <mat-icon>arrow_upward</mat-icon>
        </button>
        <span class="picker__path" [attr.title]="listing()?.path">{{
          listing()?.path
        }}</span>
      </div>

      @if (loading()) {
        <div class="picker__status"><mat-spinner diameter="32" /></div>
      } @else if (error()) {
        <p class="picker__status picker__status--error">
          {{ 'DIRECTORY_PICKER.ERROR' | translate }}
        </p>
      } @else {
        <ul class="picker__list">
          @for (entry of listing()?.entries ?? []; track entry.path) {
            <li>
              <button
                type="button"
                class="picker__entry"
                (click)="open(entry.path)"
              >
                <mat-icon>folder</mat-icon>
                <span>{{ entry.name }}</span>
              </button>
            </li>
          } @empty {
            <li class="picker__status">
              {{ 'DIRECTORY_PICKER.EMPTY' | translate }}
            </li>
          }
        </ul>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>
        {{ 'DIRECTORY_PICKER.CANCEL' | translate }}
      </button>
      <button
        mat-flat-button
        type="button"
        [disabled]="!listing() || loading()"
        (click)="choose()"
      >
        {{ 'DIRECTORY_PICKER.SELECT' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .picker {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: min(560px, 80vw);
    }
    .picker__roots {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .picker__current {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: monospace;
    }
    .picker__path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
      text-align: left;
    }
    .picker__list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 50vh;
      overflow-y: auto;
    }
    .picker__entry {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 48px;
      padding: 0 12px;
      border: 0;
      border-radius: var(--mat-sys-corner-small);
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .picker__entry:hover,
    .picker__entry:focus-visible {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .picker__status {
      display: flex;
      justify-content: center;
      padding: 24px;
      opacity: 0.7;
    }
    .picker__status--error {
      color: var(--mat-sys-error, #b3261e);
      opacity: 1;
    }
  `,
})
export class DirectoryPickerDialogComponent implements OnInit {
  readonly data = inject<DirectoryPickerData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<DirectoryPickerDialogComponent, string>,
  );
  private readonly directoryBrowser = inject(DirectoryBrowserService);

  readonly listing = signal<DirectoryListing | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  ngOnInit(): void {
    this.open(this.data.initialPath);
  }

  open(path?: string | null): void {
    this.loading.set(true);
    this.error.set(false);
    this.directoryBrowser.browse(path).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  choose(): void {
    const listing = this.listing();
    if (listing) {
      this.dialogRef.close(listing.path);
    }
  }
}
