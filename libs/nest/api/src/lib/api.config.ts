import * as path from 'node:path';

/**
 * Default runtime configuration for the Fotobox API.
 *
 * Paths can be overridden via environment variables so the server can run on
 * any host (Windows PC, server, Electron) independently from the UI client.
 */
export const getDefaultConfig = () => {
  const cwd = process.cwd();
  return {
    photoDirectory: process.env.FOTOBOX_PHOTO_DIR || path.join(cwd, 'photos'),
    templateDirectory:
      process.env.FOTOBOX_TEMPLATE_DIR || path.join(cwd, 'collage-templates'),
    settingsPath: process.env.FOTOBOX_SETTINGS_PATH,
  };
};
