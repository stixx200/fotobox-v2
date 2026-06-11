import { getLogger } from '@fotobox/logging';
import { bootstrapApiServer } from '@fotobox/nest-api';

const logger = getLogger('fotobox-api');

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrapApiServer().catch((error) => {
  logger.error('Failed to start Fotobox API:', error);
  process.exit(1);
});
