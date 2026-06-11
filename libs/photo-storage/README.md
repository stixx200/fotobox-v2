# @fotobox/photo-storage

Photo storage library for managing photo saving and retrieval in the Fotobox application.

## Overview

The `@fotobox/photo-storage` library provides a singleton-based service for managing photo storage operations. It handles:

- **Photo saving** with configurable storage directory
- **Photo retrieval** by photo ID
- **Photo existence checks**
- **Photo deletion**
- **Automatic directory creation**
- **Configurable storage paths** with sane defaults

## Installation

The library is already part of the workspace. To use it in your project:

```typescript
import { PhotoStorageService, PhotoStorageConfig } from '@fotobox/photo-storage';
```

## Usage

### Basic Usage

```typescript
import { PhotoStorageService } from '@fotobox/photo-storage';

// Get the singleton instance with default configuration (cwd/photos)
const photoStorage = PhotoStorageService.getInstance();

// Save a photo
const photoBuffer = Buffer.from(imageData);
const filePath = photoStorage.savePhoto('photo-123', photoBuffer);

// Retrieve a photo
const retrievedPhoto = photoStorage.getPhoto('photo-123');

// Check if a photo exists
if (photoStorage.photoExists('photo-123')) {
  console.log('Photo exists');
}

// Delete a photo
photoStorage.deletePhoto('photo-123');
```

### Custom Configuration

```typescript
import { PhotoStorageService } from '@fotobox/photo-storage';

// Initialize with custom directory
const photoStorage = PhotoStorageService.getInstance({
  photoDirectory: '/custom/photo/path'
});

// Update configuration
photoStorage.setConfig({ photoDirectory: '/new/photo/path' });

// Get current directory
console.log(photoStorage.getPhotoDirectory());
```

## API Reference

### `PhotoStorageService`

Singleton service for managing photo storage.

#### Static Methods

- **`getInstance(config?: PhotoStorageConfig): PhotoStorageService`**
  - Gets or creates the singleton instance
  - Optional config to initialize with

- **`reset(): void`**
  - Resets the singleton instance (mainly for testing)

#### Instance Methods

- **`setConfig(config: PhotoStorageConfig): void`**
  - Updates the photo storage configuration

- **`getConfig(): PhotoStorageConfig`**
  - Gets a copy of the current configuration

- **`savePhoto(photoId: string, photoBuffer: Buffer): string`**
  - Saves a photo to storage
  - Returns the file path where the photo was saved

- **`getPhoto(photoId: string): Buffer`**
  - Retrieves a photo from storage
  - Throws an error if the photo doesn't exist

- **`photoExists(photoId: string): boolean`**
  - Checks if a photo exists in storage

- **`deletePhoto(photoId: string): void`**
  - Deletes a photo from storage
  - Does not throw if the photo doesn't exist

- **`getPhotoDirectory(): string`**
  - Returns the current photo directory path

### `PhotoStorageConfig`

Configuration interface for photo storage.

```typescript
interface PhotoStorageConfig {
  /**
   * Directory where photos will be stored
   * Defaults to {cwd}/photos
   */
  photoDirectory?: string;
}
```

## Default Configuration

If no configuration is provided, photos are stored in `{current_working_directory}/photos`.

## Error Handling

The service throws errors in the following cases:

- `getPhoto()`: Photo not found
- `savePhoto()`: Failed to write photo to disk
- `deletePhoto()`: Failed to delete photo
- Directory creation: Failed to create photo directory

## Integration with Electron

When used in the Electron application with NestJS backend, use the `@fotobox/nest-photo-storage` module which provides GraphQL resolvers and a provider service that wraps this library.

## Running Tests

```bash
nx test photo-storage
```

## Related Libraries

- **@fotobox/nest-photo-storage** - NestJS integration module that provides GraphQL endpoints for photo storage operations
