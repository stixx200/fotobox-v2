# @fotobox/nest-photo-storage

NestJS integration module for photo storage operations in the Fotobox application.

## Overview

The `@fotobox/nest-photo-storage` module provides NestJS bindings for the photo storage functionality, including:

- **PhotoStorageProviderService** - Wrapper service around the core PhotoStorageService
- **GraphQL Resolvers** - Expose photo storage operations via GraphQL endpoint
- **Photo directory management** - Update and retrieve photo storage location
- **Photo lifecycle** - Save, retrieve, check existence, and delete photos

## Installation

The module is part of the workspace and should be imported in your NestJS application module.

## Usage

### Import the Module

```typescript
import { Module } from '@nestjs/common';
import { NestPhotoStorageModule } from '@fotobox/nest-photo-storage';

@Module({
  imports: [NestPhotoStorageModule],
  // ... rest of your module
})
export class AppModule {}
```

### Use the Service

```typescript
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MyPhotoService {
  constructor(private photoStorage: PhotoStorageProviderService) {}

  async saveUserPhoto(userId: string, imageBuffer: Buffer) {
    const photoId = `user-${userId}-${Date.now()}`;
    const filePath = this.photoStorage.savePhoto(photoId, imageBuffer);
    return { photoId, filePath };
  }

  async getUserPhoto(photoId: string) {
    return this.photoStorage.getPhoto(photoId);
  }
}
```

### GraphQL Queries and Mutations

#### Queries

**Get Photo Directory**
```graphql
query {
  photoDirectory
}
```

**Check if Photo Exists**
```graphql
query {
  photoExists(photoId: "photo-123")
}
```

#### Mutations

**Set Photo Directory**
```graphql
mutation {
  setPhotoDirectory(directory: "/new/photo/path")
}
```

**Delete Photo**
```graphql
mutation {
  deletePhoto(photoId: "photo-123")
}
```

## API Reference

### PhotoStorageProviderService

NestJS Injectable service that wraps the core PhotoStorageService.

#### Methods

- **`setPhotoDirectory(directory: string): void`**
  - Updates the photo directory configuration

- **`getPhotoDirectory(): string`**
  - Returns the current photo directory path

- **`savePhoto(photoId: string, photoBuffer: Buffer): string`**
  - Saves a photo and returns the file path

- **`getPhoto(photoId: string): Buffer`**
  - Retrieves a photo from storage

- **`photoExists(photoId: string): boolean`**
  - Checks if a photo exists

- **`deletePhoto(photoId: string): void`**
  - Deletes a photo from storage

- **`getPhotoStorageService(): PhotoStorageService`**
  - Gets the underlying PhotoStorageService instance

## Default Configuration

Photos are stored in `{current_working_directory}/photos` by default. This can be overridden via the GraphQL mutation or by calling `setPhotoDirectory()` at runtime.

## Related Libraries

- **@fotobox/photo-storage** - Core photo storage library providing the underlying implementation

