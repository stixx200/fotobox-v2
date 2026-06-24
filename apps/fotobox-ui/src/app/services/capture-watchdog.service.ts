import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, Subscription, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { CameraStore } from '../store';
import { NotificationService } from './notification.service';
import { RecoveryService } from './recovery.service';

/** Slightly longer than the server-side camera timeout (30 s). */
const CAPTURE_TIMEOUT_MS = 35_000;

/**
 * Watches an in-flight photo capture for timeouts and camera errors so layout
 * screens never stay stuck in a capturing state.
 */
@Injectable({ providedIn: 'root' })
export class CaptureWatchdogService {
  private readonly cameraStore = inject(CameraStore);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly recovery = inject(RecoveryService);

  start(onRecover: () => void): () => void {
    let finished = false;

    const recover = (message: string) => {
      if (finished) {
        return;
      }
      finished = true;
      onRecover();
      this.notification.error(message);
      this.recovery.recordCaptureFailure();
    };

    const timeoutId = setTimeout(() => {
      recover(this.translate.instant('CAPTURE.TIMEOUT'));
    }, CAPTURE_TIMEOUT_MS);

    const errorSub: Subscription = toObservable(this.cameraStore.error)
      .pipe(
        filter((err): err is string => !!err),
        take(1),
      )
      .subscribe((err) => recover(err));

    return () => {
      finished = true;
      clearTimeout(timeoutId);
      errorSub.unsubscribe();
    };
  }

  onCaptureSuccess(): void {
    this.recovery.recordCaptureSuccess();
  }
}
