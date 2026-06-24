export interface LogRecord {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  metaJson?: string;
}

const MAX_LOG_ENTRIES = 500;

const entries: LogRecord[] = [];

export function addLogRecord(record: LogRecord): void {
  entries.push(record);
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.splice(0, entries.length - MAX_LOG_ENTRIES);
  }
}

export function getRecentLogs(limit = 200): LogRecord[] {
  const count = Math.max(1, Math.min(limit, MAX_LOG_ENTRIES));
  return entries.slice(-count);
}

export function clearLogBuffer(): void {
  entries.length = 0;
}
