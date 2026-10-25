import type { INestApplication } from '@nestjs/common';
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

let app: INestApplication | undefined;

/**
 * Desktop sidecar mode: the Tauri host keeps our stdin open for its whole
 * lifetime. When the host exits or crashes, the OS closes the pipe and we shut
 * down too, so no orphaned API keeps holding the port.
 */
if (process.env['FOTOBOX_EXIT_ON_STDIN_CLOSE'] === '1') {
  const shutdown = () => {
    logger.info('Host process gone (stdin closed), shutting down');
    setTimeout(() => process.exit(0), 3000).unref();
    void (app?.close() ?? Promise.resolve()).finally(() => process.exit(0));
  };
  process.stdin.on('end', shutdown);
  process.stdin.on('error', shutdown);
  process.stdin.resume();
}

bootstrapApiServer()
  .then((started) => {
    app = started;
  })
  .catch((error) => {
    logger.error('Failed to start Fotobox API:', error);
    process.exit(1);
  });
