import * as winston from 'winston';
import * as Transport from 'winston-transport';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getWorkspaceLogFile } from '@fotobox/workspace-paths';
import { LogBufferTransport } from './log-buffer.transport';

export { getRecentLogs, clearLogBuffer, type LogRecord } from './log-buffer';

export function close() {
  getConsoleTransport().close?.();
  getFileTransport().close?.();
  getBufferTransport().close?.();
}

let rootLogger: winston.Logger | undefined;

/**
 * Loggers share one root logger and its transports; each context is a child
 * logger. Creating a full logger per context attached another set of
 * listeners to the shared transports (MaxListenersExceededWarning).
 */
export function getLogger(context?: string): winston.Logger {
  rootLogger ??= winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      getConsoleTransport(),
      getFileTransport(),
      getBufferTransport(),
    ],
  });
  return rootLogger.child({ context });
}

const transports: Map<string, Transport> = new Map();

function getOrCreateTransport(key: string, create: () => Transport): Transport {
  let transport = transports.get(key);
  if (!transport) {
    transport = create();
    transports.set(key, transport);
  }
  return transport;
}

function getConsoleTransport(): Transport {
  return getOrCreateTransport(
    'console',
    () =>
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
  );
}

function getFileTransport(): Transport {
  return getOrCreateTransport('file', () => {
    const filename = getWorkspaceLogFile();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    return new winston.transports.File({
      filename,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    });
  });
}

function getBufferTransport(): Transport {
  return getOrCreateTransport('buffer', () => new LogBufferTransport());
}
