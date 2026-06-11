import * as path from 'path';

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
    photoDirectory: path.join(process.cwd(), 'photos'),
  };
}
