# Photo Storage Implementation Summary

## Overview

A complete photo storage solution has been implemented for the Fotobox application, consisting of two complementary libraries:

1. **@fotobox/photo-storage** - Core Node.js library for photo file management
2. **@fotobox/nest-photo-storage** - NestJS wrapper providing GraphQL integration

## What Was Created

### 1. Photo Storage Library (`libs/photo-storage/`)

A standalone Node.js library that handles photo persistence operations:

**Key Features:**
- Singleton pattern for resource-efficient photo management
- Default storage location: `{cwd}/photos` (overridable)
- Automatic directory creation
- Support for saving, retrieving, checking existence, and deleting photos
- Comprehensive error handling

**Core Service:** `PhotoStorageService`
- `getInstance(config?)` - Get singleton instance
- `savePhoto(photoId, photoBuffer)` - Save photo to disk
- `getPhoto(photoId)` - Retrieve photo from disk
- `photoExists(photoId)` - Check if photo exists
- `deletePhoto(photoId)` - Delete photo
- `setConfig(config)` - Update storage configuration
- `getPhotoDirectory()` - Get current directory

**Configuration:**
```typescript
interface PhotoStorageConfig {
  photoDirectory?: string; // Default: {cwd}/photos
}
```

**Tests:** 7 passing unit tests covering all core functionality

### 2. NestJS Photo Storage Module (`libs/nest/photo-storage/`)

A NestJS integration layer providing GraphQL endpoints for the underlying photo storage service:

**Components:**
- `NestPhotoStorageModule` - Easily importable NestJS module
- `PhotoStorageProviderService` - NestJS wrapper around core service
- `PhotoStorageResolver` - GraphQL resolver exposing photo operations

**GraphQL Queries:**
```graphql
query {
  photoDirectory  # Get current storage path
  photoExists(photoId: "photo-123")  # Check if photo exists
}
```

**GraphQL Mutations:**
```graphql
mutation {
  setPhotoDirectory(directory: "/new/path")  # Update storage path
  deletePhoto(photoId: "photo-123")  # Delete a photo
}
```

## Integration Points

### Settings Component Integration

The `settings.component.html` has been updated to:
- Display the "Speicherort für Fotos" (photo storage location) setting field
- Connect to the photoDirectory form control
- Provide a save settings button that triggers GraphQL mutations

**How It Works:**
1. User updates the photo storage location in settings UI
2. Form value is captured in the `photoDirectory` FormControl
3. On save, settings are persisted via the SettingsService (GraphQL)
4. Backend updates the PhotoStorageService configuration
5. All subsequent photos are saved to the new location

### Electron Backend

The NestJS photo storage module is:
1. Imported in the Electron app's NestJS backend
2. Exposed via GraphQL endpoints
3. Available for use by other NestJS services

## File Structure

```
libs/
  photo-storage/
    src/
      lib/
        photo-storage.config.ts      # Configuration interface
        photo-storage.service.ts     # Core service implementation
        photo-storage.spec.ts        # Unit tests
      index.ts                       # Public API
    README.md                        # Library documentation

  nest/
    photo-storage/
      src/
        lib/
          nest-photo-storage.module.ts      # NestJS module
          photo-storage-provider.service.ts # NestJS wrapper
          photo-storage.resolver.ts         # GraphQL resolver
        index.ts                            # Public API
      eslint.config.mjs
      README.md                            # Integration documentation

apps/
  fotobox-ui/
    src/
      app/
        settings/
          settings.component.html           # Updated with save button
          settings.component.ts             # Updated (cleanup)

tsconfig.base.json  # Updated with @fotobox/* scoped paths
```

## Usage Examples

### In NestJS Service

```typescript
import { PhotoStorageProviderService } from '@fotobox/nest-photo-storage';

@Injectable()
export class CameraService {
  constructor(private photoStorage: PhotoStorageProviderService) {}

  async onPhotoCapture(photoBuffer: Buffer) {
    const photoId = `photo-${Date.now()}`;
    const path = this.photoStorage.savePhoto(photoId, photoBuffer);
    return { photoId, path };
  }
}
```

### Via GraphQL

```graphql
# Frontend settings update
mutation UpdatePhotoDirectory {
  setPhotoDirectory(directory: "/home/user/photos")
}

# Check if photo was saved
query CheckPhoto {
  photoExists(photoId: "photo-123")
}
```

### Direct Node.js Usage

```typescript
import { PhotoStorageService } from '@fotobox/photo-storage';

const storage = PhotoStorageService.getInstance({
  photoDirectory: '/custom/path'
});

const savedPath = storage.savePhoto('my-photo', imageBuffer);
const photo = storage.getPhoto('my-photo');
storage.deletePhoto('my-photo');
```

## Configuration

The photo directory can be configured through:

1. **Settings UI** - Via the "Speicherort für Fotos" setting
2. **GraphQL Mutation** - `setPhotoDirectory(directory: String)`
3. **Direct Service Call** - `setConfig({ photoDirectory: String })`
4. **Initialization** - Pass config to `getInstance()`

Default location: `{current_working_directory}/photos`

## Testing

All libraries include unit tests:

```bash
# Test photo-storage core library
nx test photo-storage

# Both libraries compile without TypeScript errors
npx tsc --noEmit
```

## Path Aliases

The following path aliases are configured in `tsconfig.base.json`:

```json
{
  "@fotobox/photo-storage": ["libs/photo-storage/src/index.ts"],
  "@fotobox/nest-photo-storage": ["libs/nest/photo-storage/src/index.ts"]
}
```

## Next Steps

1. **Connect Camera Service** - Integrate photo capture with PhotoStorageService
2. **Add Photo Retrieval Endpoints** - Implement GraphQL query to fetch photos by ID
3. **Add File Transfer** - Handle photo streaming/download from storage
4. **Add Cleanup Tasks** - Implement photo rotation/retention policies
5. **Add Monitoring** - Track storage usage and available space

## Fixes Applied

1. Fixed duplicate `baseConfig` import in `eslint.config.mjs`
2. Added missing `eslint.config.mjs` to nest-photo-storage
3. Updated tsconfig.base.json with proper @fotobox scoped paths
4. Fixed settings component HTML form control bindings
