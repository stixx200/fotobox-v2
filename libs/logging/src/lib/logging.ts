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

export function getLogger(context?: string) {
  const consoleTransport = getConsoleTransport();
  const fileTransport = getFileTransport();
  const bufferTransport = getBufferTransport();

  return winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [consoleTransport, fileTransport, bufferTransport],
    defaultMeta: { context },
  });
}

const transports: Map<string, Transport> = new Map();
function getConsoleTransport(): Transport {
  if (!transports.has('console')) {
    transports.set(
      'console',
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    );
  }
  return transports.get('console')!;
}
function getFileTransport(): Transport {
  if (!transports.has('file')) {
    const filename = getWorkspaceLogFile();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    transports.set(
      'file',
      new winston.transports.File({
        filename,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }
  return transports.get('file')!;
}

function getBufferTransport(): Transport {
  if (!transports.has('buffer')) {
    transports.set('buffer', new LogBufferTransport());
  }
  return transports.get('buffer')!;
}
