import { LoggerService } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';

const logger = getLogger();

// Logger service implementation compatible with NestJS Logger interface
export class WinstonLoggerService implements LoggerService {
  log(message: any, context?: string): void {
    logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string): void {
    logger.error(message, { trace, context });
  }

  warn(message: any, context?: string): void {
    logger.warn(message, { context });
  }

  debug?(message: any, context?: string): void {
    logger.debug?.(message, { context });
  }

  verbose?(message: any, context?: string): void {
    logger.verbose?.(message, { context });
  }
}
