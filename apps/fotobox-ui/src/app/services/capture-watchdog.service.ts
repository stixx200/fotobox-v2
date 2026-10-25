import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, Subscription, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { CameraStore } from '../store';
import { NotificationService } from './notification.service';
import { RecoveryService } from './recovery.service';
import { ClientLogService } from './client-log.service';

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
  private readonly clientLog = inject(ClientLogService);
  /**
   * Created once in the injection context: `start()` runs from click
   * handlers, where `toObservable()` throws NG0203.
   */
  private readonly cameraError$ = toObservable(this.cameraStore.error);

  start(onRecover: () => void): () => void {
    let finished = false;

    // Guests only ever see a friendly message; the technical cause goes to
    // the client log for the operator (debug page).
    const recover = (messageKey: string, detail: string) => {
      if (finished) {
        return;
      }
      finished = true;
      onRecover();
      this.clientLog.error('Photo capture failed', detail);
      this.notification.error(this.translate.instant(messageKey));
      this.recovery.recordCaptureFailure();
    };

    const timeoutId = setTimeout(() => {
      recover('CAPTURE.TIMEOUT', `No picture after ${CAPTURE_TIMEOUT_MS} ms`);
    }, CAPTURE_TIMEOUT_MS);

    // toObservable replays the current value first; an error left over from
    // a previous capture must not abort this one.
    const errorAtStart = this.cameraStore.error();
    const errorSub: Subscription = this.cameraError$
      .pipe(
        filter(
          (err, index): err is string =>
            !!err && !(index === 0 && err === errorAtStart),
        ),
        take(1),
      )
      .subscribe((err) => recover('CAPTURE.FAILED', err));

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
