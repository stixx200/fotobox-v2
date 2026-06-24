import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PhotoStorageService } from '@fotobox/photo-storage';
import { PhotoRepository } from '@fotobox/nest-database';
import { SettingsService } from '@fotobox/nest-settings';

@Injectable()
export class PhotoStorageProviderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PhotoStorageProviderService.name);
  private photoStorageService: PhotoStorageService;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly photoRepository: PhotoRepository,
  ) {
    this.photoStorageService = PhotoStorageService.getInstance();
  }

  /**
   * Called after all modules are initialised and settings are loaded.
   * Applies the user-configured photoDirectory (if any) so saves, lists,
   * and serves all use the same directory.
   */
  async onApplicationBootstrap(): Promise<void> {
    const directory = await this.settingsService.getParsed<string | null>(
      'photoDirectory',
      null,
    );
    if (directory?.trim()) {
      this.setPhotoDirectory(directory.trim());
      return;
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
    this.photoRepository.insertPhoto(photoId);
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
    return (
      this.photoRepository.photoExists(photoId) ||
      this.photoStorageService.photoExists(photoId)
    );
  }

  /**
   * Delete a photo from storage
   */
  deletePhoto(photoId: string): void {
    this.photoStorageService.deletePhoto(photoId);
    this.photoRepository.deletePhoto(photoId);
    this.logger.debug(`Photo ${photoId} deleted`);
  }

  /**
   * List all photos, sorted newest-first.
   */
  listPhotos(): { id: string; path: string; timestamp: string }[] {
    return this.photoRepository.listPhotos().map((photo) => ({
      id: photo.id,
      path: `/api/photos/${photo.filename}`,
      timestamp: photo.createdAt,
    }));
  }

  /**
   * Get the underlying PhotoStorageService instance
   */
  getPhotoStorageService(): PhotoStorageService {
    return this.photoStorageService;
  }
}
