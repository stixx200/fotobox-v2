import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ClientLogService } from './client-log.service';
import { RecoveryService } from './recovery.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly clientLog = inject(ClientLogService);
  private readonly recovery = inject(RecoveryService);

  handleError(error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    this.clientLog.error('Unhandled application error', error);
    console.error(error);
    this.recovery.showFatalError(message);
  }
}
