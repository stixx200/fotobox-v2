import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { CameraStore } from '../store';
import { CaptureWatchdogService } from './capture-watchdog.service';
import { NotificationService } from './notification.service';
import { RecoveryService } from './recovery.service';
import { ClientLogService } from './client-log.service';

describe('CaptureWatchdogService', () => {
  const error = signal<string | null>(null);
  const notification = { error: vi.fn() };
  const clientLog = { error: vi.fn() };
  const recovery = {
    recordCaptureFailure: vi.fn(),
    recordCaptureSuccess: vi.fn(),
  };

  beforeEach(() => {
    error.set(null);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: CameraStore, useValue: { error } },
        { provide: NotificationService, useValue: notification },
        { provide: RecoveryService, useValue: recovery },
        { provide: ClientLogService, useValue: clientLog },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
  });

  it('can be started outside an injection context (click handler)', () => {
    const watchdog = TestBed.inject(CaptureWatchdogService);
    const stop = watchdog.start(() => undefined);
    expect(typeof stop).toBe('function');
    stop();
  });

  it('shows a friendly message instead of the raw camera error', () => {
    const watchdog = TestBed.inject(CaptureWatchdogService);
    const onRecover = vi.fn();
    const stop = watchdog.start(onRecover);
    TestBed.tick();

    error.set('Camera disconnected');
    TestBed.tick();

    expect(onRecover).toHaveBeenCalledTimes(1);
    expect(notification.error).toHaveBeenCalledWith('CAPTURE.FAILED');
    expect(clientLog.error).toHaveBeenCalledWith(
      'Photo capture failed',
      'Camera disconnected',
    );
    expect(recovery.recordCaptureFailure).toHaveBeenCalledTimes(1);
    stop();
  });

  it('ignores an error left over from a previous capture', () => {
    error.set('Old failure');
    const watchdog = TestBed.inject(CaptureWatchdogService);
    const onRecover = vi.fn();
    const stop = watchdog.start(onRecover);
    TestBed.tick();

    expect(onRecover).not.toHaveBeenCalled();
    stop();
  });
});
