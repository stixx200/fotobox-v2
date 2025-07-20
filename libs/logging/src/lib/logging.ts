import * as winston from 'winston';
import * as Transport from 'winston-transport';

export function close() {
  getConsoleTransport().close?.();
  getFileTransport().close?.();
}

export function getLogger(context?: string) {
  const consoleTransport = getConsoleTransport();
  const fileTransport = getFileTransport();

  return winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [consoleTransport, fileTransport],
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
    transports.set(
      'file',
      new winston.transports.File({
        filename: 'application.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }
  return transports.get('file')!;
}
