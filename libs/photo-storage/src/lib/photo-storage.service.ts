import * as fs from 'fs';
import * as path from 'path';
import {
  PhotoStorageConfig,
  getDefaultPhotoStorageConfig,
} from './photo-storage.config';

/**
 * Singleton service for managing photo storage
 */
export class PhotoStorageService {
  private static instance: PhotoStorageService;
  private config: PhotoStorageConfig;

  private constructor(config?: PhotoStorageConfig) {
    this.config = {
      ...getDefaultPhotoStorageConfig(),
      ...config,
    };
    this.ensureDirectoryExists();
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(config?: PhotoStorageConfig): PhotoStorageService {
    if (!PhotoStorageService.instance) {
      PhotoStorageService.instance = new PhotoStorageService(config);
    }
    return PhotoStorageService.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static reset(): void {
    PhotoStorageService.instance = null as any;
  }

  /**
   * Update the photo storage configuration
   */
  setConfig(config: PhotoStorageConfig): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.ensureDirectoryExists();
  }

  /**
   * Get current configuration
   */
  getConfig(): PhotoStorageConfig {
    return { ...this.config };
  }

  /**
   * Save a photo to storage
   * @param photoId Unique identifier for the photo
   * @param photoBuffer Buffer containing the photo data
   * @returns Path where the photo was saved
   */
  savePhoto(photoId: string, photoBuffer: Buffer): string {
    const photoDirectory =
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!;
    const filePath = path.join(photoDirectory, `${photoId}.jpg`);

    try {
      fs.writeFileSync(filePath, photoBuffer);
      return filePath;
    } catch (error) {
      throw new Error(
        `Failed to save photo ${photoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a photo from storage
   * @param photoId Unique identifier for the photo
   * @returns Buffer containing the photo data
   */
  getPhoto(photoId: string): Buffer {
    const photoDirectory =
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!;
    const filePath = path.join(photoDirectory, `${photoId}.jpg`);

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Photo ${photoId} not found`);
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      throw new Error(
        `Failed to retrieve photo ${photoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if a photo exists in storage
   * @param photoId Unique identifier for the photo
   */
  photoExists(photoId: string): boolean {
    const photoDirectory =
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!;
    const filePath = path.join(photoDirectory, `${photoId}.jpg`);
    return fs.existsSync(filePath);
  }

  /**
   * Delete a photo from storage
   * @param photoId Unique identifier for the photo
   */
  deletePhoto(photoId: string): void {
    const photoDirectory =
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!;
    const filePath = path.join(photoDirectory, `${photoId}.jpg`);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete photo ${photoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List all photos in storage, sorted newest-first.
   * Returns objects with the photo id, a server-relative path usable by the
   * UI's getPhotoUrl() helper, and the file modification timestamp.
   */
  listPhotos(): { id: string; path: string; timestamp: string }[] {
    const photoDirectory =
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!;
    if (!fs.existsSync(photoDirectory)) {
      return [];
    }
    return fs
      .readdirSync(photoDirectory)
      .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
      .map((f) => {
        const stat = fs.statSync(path.join(photoDirectory, f));
        const id = path.basename(f, path.extname(f));
        return {
          id,
          path: `/api/photos/${f}`,
          timestamp: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Get the current photo directory path
   */
  getPhotoDirectory(): string {
    return (
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!
    );
  }

  /**
   * Ensure the photo directory exists, creating it if necessary
   */
  private ensureDirectoryExists(): void {
    const photoDirectory =
      this.config.photoDirectory ||
      getDefaultPhotoStorageConfig().photoDirectory!;
    if (!fs.existsSync(photoDirectory)) {
      try {
        fs.mkdirSync(photoDirectory, { recursive: true });
      } catch (error) {
        throw new Error(
          `Failed to create photo directory ${photoDirectory}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
