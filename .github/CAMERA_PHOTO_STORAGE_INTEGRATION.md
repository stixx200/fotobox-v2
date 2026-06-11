# Photo Storage Integration with Camera Service

## Implementation Summary

The photo-storage library has been successfully integrated with the NestJS camera service. When photos are captured, they are now automatically saved to disk and published via GraphQL subscriptions.

## Changes Made

### 1. Camera Service Updates (`libs/nest/cameras-api/src/lib/cameras.service.ts`)

**Added:**
- Dependency injection of `PhotoStorageProviderService`
- `PhotoSavedEvent` interface for emitting saved photo details
- `photoSavedSubject` (Subject) to emit photo save events
- `setupPictureCapture()` method that subscribes to camera's `observePictures()` stream
- `handleCapturedPicture()` method that:
  - Converts picture data (base64, file path, or raw buffer) to Buffer
  - Saves the photo using `PhotoStorageService.savePhoto()`
  - Emits a `PhotoSavedEvent` via the subject
- `getPhotoSavedObservable()` method to expose the photo saved events
- `OnModuleDestroy` lifecycle hook for proper cleanup
- Constructor injection of `PhotoStorageProviderService`

**Flow:**
1. When camera is initialized, `setupPictureCapture()` subscribes to camera's photo stream
2. When `takePicture()` is called on the camera, it emits photo data via `observePictures()`
3. `handleCapturedPicture()` receives the photo data
4. Photo is automatically saved to storage with auto-generated ID: `photo-{timestamp}`
5. `PhotoSavedEvent` is emitted with photo ID, file path, and timestamp

### 2. Camera Module Updates (`libs/nest/cameras-api/src/lib/cameras-api.module.ts`)

**Added:**
- Import of `NestPhotoStorageModule` to make `PhotoStorageProviderService` available for dependency injection

### 3. Camera Resolver Updates (`libs/nest/cameras-api/src/lib/cameras.resolver.ts`)

**Added:**
- Constructor subscription to `CameraService.getPhotoSavedObservable()`
- Publishing of saved photos via GraphQL pub/sub `PHOTO_SAVED_TOPIC`
- New GraphQL subscription `photoSaved` that clients can subscribe to for real-time photo save notifications

**GraphQL Subscriptions Available:**
```graphql
subscription {
  photoSaved {
    id          # Photo ID (e.g., "photo-1708086800000")
    path        # File path where photo is stored
    timestamp   # ISO timestamp when photo was saved
  }
}
```

## Data Flow

```
Camera captures photo
    ↓
observePictures() emits photo data
    ↓
setupPictureCapture() receives data
    ↓
handleCapturedPicture() processes it
    ↓
PhotoStorageService.savePhoto() saves to disk
    ↓
photoSavedSubject emits PhotoSavedEvent
    ↓
CameraResolver publishes via GraphQL pub/sub
    ↓
Clients receive photoSaved subscription update
```

## Photo Storage Location

Photos are saved to: `{current_working_directory}/photos/{photoId}.jpg`

This can be customized via the "Speicherort für Fotos" setting in the UI, which updates the photo storage directory via GraphQL mutation.

## Usage Examples

### GraphQL Subscription (Real-time Photo Notifications)

```graphql
subscription OnPhotoSaved {
  photoSaved {
    id
    path
    timestamp
  }
}
```

When a photo is captured:
```json
{
  "data": {
    "photoSaved": {
      "id": "photo-1708086800000",
      "path": "/home/user/photos/photo-1708086800000.jpg",
      "timestamp": "2026-02-16T10:40:00.000Z"
    }
  }
}
```

### NestJS Service Usage

```typescript
// In another service that needs access to saved photos
constructor(
  private cameraService: CameraService,
  private photoStorage: PhotoStorageProviderService
) {}

// Listen to photo saves
this.cameraService.getPhotoSavedObservable().subscribe({
  next: (photoEvent) => {
    console.log(`Photo saved: ${photoEvent.photoId} at ${photoEvent.path}`);
    // Do something with the saved photo
  }
});

// Or retrieve a photo directly
const photoBuffer = this.photoStorage.getPhoto('photo-1708086800000');
```

## Error Handling

- **Invalid photo data:** Logged and skipped
- **File path format:** Detected and skipped (for future file-based operations)
- **Base64 encoding:** Automatically detected and decoded
- **Storage errors:** Caught and logged, subscription continues

## Testing

To verify the integration:

1. Initialize a camera via GraphQL mutation:
   ```graphql
   mutation {
     initializeCamera(driver: "Demo")
   }
   ```

2. Subscribe to photo save events:
   ```graphql
   subscription {
     photoSaved {
       id
       path
       timestamp
     }
   }
   ```

3. Trigger photo capture:
   ```graphql
   mutation {
     takePicture {
       id
       path
       timestamp
     }
   }
   ```

4. The `photoSaved` subscription will emit the saved photo details

## Architecture Diagram

```
CameraService
├── currentCamera: CameraInterface
│   └── observePictures(): Observable<string>
│
├── photoStorage: PhotoStorageProviderService
│   └── savePhoto(id, buffer): string
│
├── photoSavedSubject: Subject<PhotoSavedEvent>
│
└── setupPictureCapture()
    └── subscribes to observePictures()
        └── calls handleCapturedPicture()
            └── saves photo
            └── emits PhotoSavedEvent

CameraResolver
├── subscribes to CameraService.getPhotoSavedObservable()
│
└── publishes via GraphQL pub/sub
    └── photoSaved subscription available to clients
```

## Next Steps

1. **Photo Retrieval Endpoint:** Add GraphQL query to retrieve photos by ID
2. **Photo Stream/Download:** Implement HTTP endpoint for photo download
3. **Metadata:** Store photo metadata (camera model, settings, etc.)
4. **Cleanup:** Implement photo rotation/retention policies
5. **Thumbnails:** Generate thumbnails for preview
6. **Analysis:** Process photos for collage creation
