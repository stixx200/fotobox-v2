import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  PhotoStorageService,
  PhotoStorageConfig,
} from '@fotobox/photo-storage';

@Injectable()
export class PhotoStorageProviderService implements OnModuleInit {
  private readonly logger = new Logger(PhotoStorageProviderService.name);
  private photoStorageService: PhotoStorageService;

  constructor() {
    // Initialize with default configuration
    this.photoStorageService = PhotoStorageService.getInstance();
  }

  onModuleInit(): void {
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
