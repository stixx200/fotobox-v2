import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, interval, startWith, switchMap, takeUntil } from 'rxjs';
import { DebugLogService, ServerLogEntry } from '../services/debug-log.service';
import { ClientLogService } from '../services/client-log.service';
import { CameraStore, AppMetadataStore } from '../store';
import { getGraphqlHttpUri } from '../api-config';

type LogLevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug';

@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './debug.component.html',
  styleUrl: './debug.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugComponent implements OnInit, OnDestroy {
  private readonly debugLogService = inject(DebugLogService);
  private readonly clientLogService = inject(ClientLogService);
  private readonly cameraStore = inject(CameraStore);
  private readonly appMetadataStore = inject(AppMetadataStore);
  private readonly destroy$ = new Subject<void>();

  readonly clientLogs = this.clientLogService.logs;
  readonly appVersion = this.appMetadataStore.version;
  readonly cameraError = this.cameraStore.error;
  readonly currentCamera = this.cameraStore.currentCamera;
  readonly isLiveViewActive = this.cameraStore.isLiveViewActive;

  readonly serverLogs = signal<ServerLogEntry[]>([]);
  readonly serverLogsError = signal<string | null>(null);
  readonly levelFilter = signal<LogLevelFilter>('all');
  readonly apiUrl = getGraphqlHttpUri();

  ngOnInit(): void {
    this.appMetadataStore.loadVersion();
    this.cameraStore.loadCameraStatus();
    this.cameraStore.loadAvailableCameras();

    interval(3000)
      .pipe(
        startWith(0),
        switchMap(() => this.debugLogService.getRecentLogs(300)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (entries) => {
          this.serverLogs.set(entries);
          this.serverLogsError.set(null);
        },
        error: (err) => {
          this.serverLogsError.set(
            err?.message ?? 'Failed to load server logs',
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  filteredServerLogs(): ServerLogEntry[] {
    const filter = this.levelFilter();
    if (filter === 'all') {
      return this.serverLogs();
    }
    return this.serverLogs().filter(
      (entry) => entry.level.toLowerCase() === filter,
    );
  }

  filteredClientLogs() {
    const filter = this.levelFilter();
    if (filter === 'all') {
      return this.clientLogs();
    }
    return this.clientLogs().filter((entry) => entry.level === filter);
  }

  refreshServerLogs(): void {
    this.debugLogService.getRecentLogs(300).subscribe({
      next: (entries) => {
        this.serverLogs.set(entries);
        this.serverLogsError.set(null);
      },
      error: (err) => {
        this.serverLogsError.set(err?.message ?? 'Failed to load server logs');
      },
    });
  }

  clearServerLogs(): void {
    this.debugLogService.clearServerLogs().subscribe({
      next: () => this.serverLogs.set([]),
      error: (err) => {
        this.serverLogsError.set(err?.message ?? 'Failed to clear server logs');
      },
    });
  }

  clearClientLogs(): void {
    this.clientLogService.clear();
  }

  reloadCameraStatus(): void {
    this.cameraStore.loadCameraStatus();
    this.cameraStore.loadAvailableCameras();
  }

  levelClass(level: string): string {
    return `log-level log-level--${level.toLowerCase()}`;
  }
}
