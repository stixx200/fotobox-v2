import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PhotoStorageService } from './photo-storage.service';

describe('PhotoStorageService', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    testDir = path.join(__dirname, '_test_photos');
    PhotoStorageService.reset();
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(testDir, file));
      });
      fs.rmdirSync(testDir);
    }
    PhotoStorageService.reset();
  });

  it('should create instance with default config', () => {
    const service = PhotoStorageService.getInstance();
    expect(service).toBeDefined();
    expect(service.getPhotoDirectory()).toContain('photos');
  });

  it('should create directory if it does not exist', () => {
    const service = PhotoStorageService.getInstance({ photoDirectory: testDir });
    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('should save and retrieve a photo', () => {
    const service = PhotoStorageService.getInstance({ photoDirectory: testDir });
    const photoId = 'test-photo-1';
    const photoBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header

    const savedPath = service.savePhoto(photoId, photoBuffer);
    expect(savedPath).toContain(photoId);

    const retrievedBuffer = service.getPhoto(photoId);
    expect(retrievedBuffer).toEqual(photoBuffer);
  });

  it('should check if photo exists', () => {
    const service = PhotoStorageService.getInstance({ photoDirectory: testDir });
    const photoId = 'test-photo-2';
    const photoBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    expect(service.photoExists(photoId)).toBe(false);

    service.savePhoto(photoId, photoBuffer);
    expect(service.photoExists(photoId)).toBe(true);
  });

  it('should delete a photo', () => {
    const service = PhotoStorageService.getInstance({ photoDirectory: testDir });
    const photoId = 'test-photo-3';
    const photoBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    service.savePhoto(photoId, photoBuffer);
    expect(service.photoExists(photoId)).toBe(true);

    service.deletePhoto(photoId);
    expect(service.photoExists(photoId)).toBe(false);
  });

  it('should update configuration', () => {
    const service = PhotoStorageService.getInstance();
    const initialDir = service.getPhotoDirectory();

    service.setConfig({ photoDirectory: testDir });
    expect(service.getPhotoDirectory()).toBe(testDir);
    expect(service.getPhotoDirectory()).not.toBe(initialDir);
  });

  it('should throw error when getting non-existent photo', () => {
    const service = PhotoStorageService.getInstance({ photoDirectory: testDir });
    expect(() => service.getPhoto('non-existent')).toThrow();
  });
});

