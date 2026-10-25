import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

const DEFAULT_CONFIG: MatSnackBarConfig = {
  duration: 5000,
  horizontalPosition: 'center',
  verticalPosition: 'top',
};

/**
 * Thin wrapper around Angular Material's MatSnackBar so that services and
 * stores can surface user-facing messages without directly depending on the
 * Angular Material DI hierarchy. Messages must already be human-readable
 * (translated) — never pass raw technical errors here.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  error(message: string): void {
    this.snackBar.open(message, '✕', {
      ...DEFAULT_CONFIG,
      duration: 6000,
      panelClass: ['snack-error'],
      politeness: 'assertive',
    });
  }

  info(message: string): void {
    this.snackBar.open(message, '✕', {
      ...DEFAULT_CONFIG,
      duration: 3000,
    });
  }

  success(message: string): void {
    this.snackBar.open(message, '✕', {
      ...DEFAULT_CONFIG,
      duration: 3000,
      panelClass: ['snack-success'],
    });
  }
}
