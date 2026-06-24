import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { CameraStore } from '../store';
import { ClientLogService } from './client-log.service';
import { LayoutNavigationService } from './layout-navigation.service';

const MAX_CAPTURE_FAILURES = 3;

/**
 * Central recovery logic for the kiosk: navigate to safe routes, surface fatal
 * errors, and track repeated capture failures.
 */
@Injectable({ providedIn: 'root' })
export class RecoveryService {
  private readonly router = inject(Router);
  private readonly cameraStore = inject(CameraStore);
  private readonly clientLog = inject(ClientLogService);
  private readonly layoutNavigation = inject(LayoutNavigationService);
  private readonly apollo = inject(Apollo);

  readonly fatalError = signal<string | null>(null);
  readonly networkDegraded = signal(false);

  private captureFailureCount = 0;
  private networkDegradedTimer: ReturnType<typeof setTimeout> | null = null;

  showFatalError(message: string): void {
    this.fatalError.set(message);
    this.clientLog.error('Fatal error overlay shown', message);
  }

  dismissFatalError(): void {
    this.fatalError.set(null);
  }

  reportNetworkError(message: string): void {
    this.networkDegraded.set(true);
    this.clientLog.error('Network error', message);
    if (this.networkDegradedTimer) {
      clearTimeout(this.networkDegradedTimer);
    }
    this.networkDegradedTimer = setTimeout(
      () => this.networkDegraded.set(false),
      30_000,
    );
  }

  clearNetworkDegraded(): void {
    this.networkDegraded.set(false);
    if (this.networkDegradedTimer) {
      clearTimeout(this.networkDegradedTimer);
      this.networkDegradedTimer = null;
    }
  }

  navigateToSettings(): void {
    this.cameraStore.stopLiveView();
    this.dismissFatalError();
    this.clearNetworkDegraded();
    this.captureFailureCount = 0;
    void this.apollo.client.clearStore().catch(() => undefined);
    void this.router.navigate(['/settings']);
  }

  navigateToSafeState(): void {
    const camera = this.cameraStore.currentCamera();
    if (!camera || camera.driver === 'none' || !camera.available) {
      this.navigateToSettings();
      return;
    }
    this.dismissFatalError();
    this.clearNetworkDegraded();
    void this.layoutNavigation.navigateToEntryPoint();
  }

  recordCaptureFailure(): void {
    this.captureFailureCount++;
    if (this.captureFailureCount >= MAX_CAPTURE_FAILURES) {
      this.navigateToSettings();
    }
  }

  recordCaptureSuccess(): void {
    this.captureFailureCount = 0;
  }

  retryAfterError(): void {
    this.dismissFatalError();
    window.location.reload();
  }
}
