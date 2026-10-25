import { LoggerService } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';

const logger = getLogger();

/** Nest passes strings, Errors, or arbitrary objects as the log message. */
function toLogMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.stack ?? message.message;
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

// Logger service implementation compatible with NestJS Logger interface
export class WinstonLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    logger.info(toLogMessage(message), { context });
  }

  error(message: unknown, trace?: string, context?: string): void {
    logger.error(toLogMessage(message), { trace, context });
  }

  warn(message: unknown, context?: string): void {
    logger.warn(toLogMessage(message), { context });
  }

  debug?(message: unknown, context?: string): void {
    logger.debug?.(toLogMessage(message), { context });
  }

  verbose?(message: unknown, context?: string): void {
    logger.verbose?.(toLogMessage(message), { context });
  }
}
