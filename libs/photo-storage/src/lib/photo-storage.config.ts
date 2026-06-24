import { workspacePaths } from '@fotobox/workspace-paths';

/**
 * Configuration for photo storage
 */
export interface PhotoStorageConfig {
  /**
   * Directory where photos will be stored
   * Defaults to {cwd}/photos
   */
  photoDirectory?: string;
}

/**
 * Get the default photo storage configuration
 */
export function getDefaultPhotoStorageConfig(): PhotoStorageConfig {
  return {
    photoDirectory: workspacePaths.photos(),
  };
}
