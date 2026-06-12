import { Injectable, signal } from '@angular/core';

export interface ClientLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  detail?: string;
}

const MAX_ENTRIES = 200;

@Injectable({ providedIn: 'root' })
export class ClientLogService {
  private readonly entries = signal<ClientLogEntry[]>([]);

  readonly logs = this.entries.asReadonly();

  info(message: string, detail?: unknown): void {
    this.add('info', message, detail);
  }

  warn(message: string, detail?: unknown): void {
    this.add('warn', message, detail);
  }

  error(message: string, detail?: unknown): void {
    this.add('error', message, detail);
  }

  clear(): void {
    this.entries.set([]);
  }

  private add(
    level: ClientLogEntry['level'],
    message: string,
    detail?: unknown,
  ): void {
    const next: ClientLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      detail: detail !== undefined ? this.stringify(detail) : undefined,
    };

    const updated = [...this.entries(), next];
    if (updated.length > MAX_ENTRIES) {
      updated.splice(0, updated.length - MAX_ENTRIES);
    }
    this.entries.set(updated);

    const consoleFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.info;
    consoleFn(`[Fotobox UI] ${message}`, detail ?? '');
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
