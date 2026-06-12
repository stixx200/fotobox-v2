import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PhotoStorageService } from '@fotobox/photo-storage';
import { SettingsService } from '@fotobox/nest-settings';

@Injectable()
export class PhotoStorageProviderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PhotoStorageProviderService.name);
  private photoStorageService: PhotoStorageService;

  constructor(private readonly settingsService: SettingsService) {
    // Initialize with default configuration
    this.photoStorageService = PhotoStorageService.getInstance();
  }

  /**
   * Called after all modules are initialised and settings are loaded.
   * Applies the user-configured photoDirectory (if any) so saves, lists,
   * and serves all use the same directory.
   */
  async onApplicationBootstrap(): Promise<void> {
    const setting = await this.settingsService.getSetting('photoDirectory');
    if (setting?.value) {
      try {
        const parsed: unknown = JSON.parse(setting.value);
        if (typeof parsed === 'string' && parsed.trim() !== '') {
          this.setPhotoDirectory(parsed.trim());
          return;
        }
      } catch {
        // malformed value — fall through to default
      }
    }
    this.logger.log(
      `Photo storage initialized at: ${this.photoStorageService.getPhotoDirectory()}`,
    );
  }

  /**
   * Update the photo directory configuration
   */
  setPhotoDirectory(directory: string): void {
    this.photoStorageService.setConfig({ photoDirectory: directory });
    this.logger.log(`Photo directory updated to: ${directory}`);
  }

  /**
   * Get the current photo directory
   */
  getPhotoDirectory(): string {
    return this.photoStorageService.getPhotoDirectory();
  }

  /**
   * Save a photo to storage
   */
  savePhoto(photoId: string, photoBuffer: Buffer): string {
    const filePath = this.photoStorageService.savePhoto(photoId, photoBuffer);
    this.logger.debug(`Photo ${photoId} saved to ${filePath}`);
    return filePath;
  }

  /**
   * Retrieve a photo from storage
   */
  getPhoto(photoId: string): Buffer {
    return this.photoStorageService.getPhoto(photoId);
  }

  /**
   * Check if a photo exists
   */
  photoExists(photoId: string): boolean {
    return this.photoStorageService.photoExists(photoId);
  }

  /**
   * Delete a photo from storage
   */
  deletePhoto(photoId: string): void {
    this.photoStorageService.deletePhoto(photoId);
    this.logger.debug(`Photo ${photoId} deleted`);
  }

  /**
   * List all photos, sorted newest-first.
   */
  listPhotos(): { id: string; path: string; timestamp: string }[] {
    return this.photoStorageService.listPhotos();
  }

  /**
   * Get the underlying PhotoStorageService instance
   */
  getPhotoStorageService(): PhotoStorageService {
    return this.photoStorageService;
  }
}
