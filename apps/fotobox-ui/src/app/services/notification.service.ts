import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

const DEFAULT_CONFIG: MatSnackBarConfig = {
  duration: 5000,
  horizontalPosition: 'center',
  verticalPosition: 'top',
};

/**
 * Thin wrapper around Angular Material's MatSnackBar so that services and
 * stores can surface user-facing error messages without directly depending on
 * the Angular Material DI hierarchy.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  error(message: string): void {
    this.snackBar.open(message, '✕', {
      ...DEFAULT_CONFIG,
      panelClass: ['snack-error'],
    });
  }

  info(message: string): void {
    this.snackBar.open(message, '✕', {
      ...DEFAULT_CONFIG,
      duration: 3000,
      panelClass: ['snack-info'],
    });
  }
}
