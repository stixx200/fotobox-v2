import {
  workspacePaths,
} from '@fotobox/workspace-paths';

/**
 * Default runtime configuration for the Fotobox API.
 *
 * `applyDefaultWorkspaceEnv()` runs in `bootstrapApiServer()` before the Nest
 * app is created, so env-based paths are already set when this loader runs.
 */
export const getDefaultConfig = () => {
  return {
    photoDirectory: workspacePaths.photos(),
    templateDirectory: workspacePaths.collageTemplates(),
    settingsPath: process.env['FOTOBOX_SETTINGS_PATH'],
  };
};
