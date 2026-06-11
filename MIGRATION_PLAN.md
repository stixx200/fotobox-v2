# Fotobox-UI Signal & Signal-Store Migration Plan

## Current State Analysis

### Architecture Overview
The fotobox-ui app currently uses:
- **Angular 21.1.4** (Standalone API)
- **RxJS Observables** for asynchronous data management
- **Reactive Forms** with FormGroup/FormControl
- **Services** that return Observables (Observable-first pattern)
- **GraphQL** via Apollo Client for backend communication
- **OnPush** change detection strategy

### Current Components & Services

#### Components
- `AppComponent` - Root component
- `SettingsComponent` - Settings form with load/save functionality

#### Services
1. **SettingsService**
   - `getAllSettings()` - Returns Observable<Setting[]>
   - `getSetting(key)` - Returns Observable<Setting | null>
   - `updateSetting(key, value)` - Returns Observable<Setting>
   - `updateSettings(settings)` - Returns Observable<Setting[]>
   - `resetSettings()` - Returns Observable<MutationResult>

2. **CameraService**
   - `getAvailableCameras()` - Returns Observable<Camera[]>
   - `getCameraStatus()` - Returns Observable<CameraStatus>
   - `initializeCamera(driver)` - Returns Observable<MutationResult>
   - And other camera-related operations

3. **AppMetadataService**
   - `getAppMetadata()` - Returns Observable<AppMetadata>
   - `getAppVersion()` - Returns Observable<string>

### Issues with Current Approach
1. Observable management requires manual subscription handling
2. Forms don't automatically adapt to signal-based state
3. No built-in caching or state management
4. Difficult to compose and combine derived state
5. Manual RefetchQueries needed for Apollo cache invalidation
6. No clear data flow visualization

## Migration Strategy

### Phase 1: Install Dependencies
- Add `@ngrx/signals` (Signal Store framework)
- Keep `rxjs` for now (gradual migration)
- Keep `apollo-angular` for GraphQL operations

### Phase 2: Create Signal Stores
1. **SettingsStore** - Manage application settings state
2. **CameraStore** - Manage camera selection and status
3. **AppMetadataStore** - Store app version and metadata

### Phase 3: Refactor Services
1. Convert services to use Signal Store internally
2. Add computed signals for derived state
3. Implement effects for side effects (Apollo queries)
4. Create signal-based API on existing services  

### Phase 4: Update Components
1. Update `SettingsComponent` to use signals
2. Replace async pipe with signal syntax
3. Convert FormGroup to work with signals
4. Update template bindings

### Phase 5: Optimize & Clean Up
1. Remove unused observables if fully migrated
2. Remove manual subscription management
3. Update tests

## Implementation Plan

### Benefits of Migration
✅ Better state management with Signal Store
✅ Type-safe computed properties
✅ Fine-grained reactivity (only affected views re-render)
✅ Less boilerplate for async operations
✅ Better testability
✅ Clearer data flow
✅ Built-in caching support
✅ No OnDestroy needed for cleanup

### Architecture After Migration
```
AppComponent
├── AppStore (root state)
├── SettingsComponent
│   ├── settingsStore (settings state)
│   ├── cameraStore (camera state)
│   └── Template uses signals directly (no async pipe)
└── Services (Apollo clients)
    ├── SettingsService
    ├── CameraService
    └── AppMetadataService
```

## Risk Assessment
- **Low Risk**: Migration is additive, can work alongside existing RxJS code
- **Backward Compatible**: Services can expose both Observable and Signal APIs
- **Incremental**: Can migrate one component at a time

## Timeline Estimate
- Phase 1 (Dependencies): 10 mins
- Phase 2 (Signal Stores): 30 mins
- Phase 3 (Refactor Services): 45 mins
- Phase 4 (Update Components): 30 mins
- Phase 5 (Optimization): 20 mins
- **Total: ~2 hours**

## Next Steps
1. Install @ngrx/signals and dependencies
2. Create store files
3. Implement SettingsStore
4. Update SettingsComponent
5. Test and validate
