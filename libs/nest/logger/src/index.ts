import { LoggerService } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';

const logger = getLogger();

export class WinstonLoggerService implements LoggerService {
  log(message: any, context?: string) {
    logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    logger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    logger.warn(message, { context });
  }

  debug?(message: any, context?: string) {
    logger.debug?.(message, { context });
  }

  verbose?(message: any, context?: string) {
    logger.verbose?.(message, { context });
  }
}
