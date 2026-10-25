import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { describeApiError } from './api-error';

export interface NotifyAction {
  /** Translation key of the action button label. */
  label: string;
  run: () => void;
}

/** Snack-bar feedback with translated texts (M3 "snackbar" pattern). */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  info(
    key: string,
    params?: Record<string, unknown>,
    action?: NotifyAction,
  ): void {
    this.open(key, params, action, false);
  }

  error(
    key: string,
    params?: Record<string, unknown>,
    action?: NotifyAction,
  ): void {
    this.open(key, params, action, true);
  }

  /**
   * Show a human readable message for an API error. Offers `retry` as action
   * when the failure looks transient (API unreachable).
   */
  apiError(error: unknown, fallbackKey: string, retry?: () => void): void {
    console.error('[collage-editor]', error);
    const described = describeApiError(error, fallbackKey);
    this.error(
      described.key,
      described.params,
      retry && described.retryable
        ? { label: 'common.retry', run: retry }
        : undefined,
    );
  }

  private open(
    key: string,
    params: Record<string, unknown> | undefined,
    action: NotifyAction | undefined,
    isError: boolean,
  ): void {
    const ref = this.snackBar.open(
      this.translate.instant(key, params),
      action ? this.translate.instant(action.label) : undefined,
      {
        panelClass: isError ? 'snack-error' : undefined,
        // Errors with an action stay until dismissed; others auto-hide.
        duration: isError && action ? undefined : isError ? 8000 : 4000,
        politeness: isError ? 'assertive' : 'polite',
      },
    );
    if (action) {
      ref.onAction().subscribe(() => action.run());
    }
  }
}
