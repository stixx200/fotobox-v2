import { computed, inject, Injectable, effect } from '@angular/core';
import {
  signalStore,
  withState,
  patchState,
  withMethods,
  withComputed,
  withHooks,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of, EMPTY, distinctUntilChanged } from 'rxjs';
import {
  CameraService,
  CameraInfo,
  Picture,
  LiveViewFrame,
} from '../services/camera.service';

type CameraState = {
  availableCameras: CameraInfo[];
  currentCamera: CameraInfo | null;
  isLoading: boolean;
  error: string | null;
  isLiveViewActive: boolean;
  lastPicture: Picture | null;
  lastLiveFrame: LiveViewFrame | null;
};

@Injectable({ providedIn: 'root' })
export class CameraStore extends signalStore(
  withState<CameraState>({
    availableCameras: [],
    currentCamera: null,
    isLoading: false,
    error: null,
    isLiveViewActive: false,
    lastPicture: null,
    lastLiveFrame: null,
  }),
  withComputed((state) => ({
    camera$: computed(() => ({
      availableCameras: state.availableCameras(),
      currentCamera: state.currentCamera(),
      isLoading: state.isLoading(),
      error: state.error(),
    })),
    hasAvailableCameras: computed(() => state.availableCameras().length > 0),
    availableCameraNames: computed(() =>
      state.availableCameras().map((camera) => camera.driver),
    ),
    isClientCamera: computed(
      () => state.currentCamera()?.location === 'client',
    ),
  })),
  withMethods((store, cameraService = inject(CameraService)) => ({
    loadAvailableCameras: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          cameraService.getAvailableCameras().pipe(
            tap((cameras) =>
              patchState(store, {
                availableCameras: cameras,
                isLoading: false,
              }),
            ),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to load available cameras';
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    loadCameraStatus: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          cameraService.getCameraStatus().pipe(
            tap((camera) =>
              patchState(store, {
                currentCamera: camera,
                isLoading: false,
              }),
            ),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to load camera status';
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    initializeCamera: rxMethod<string>(
      pipe(
        tap((driver) => {
          patchState(store, { isLoading: true, error: null });
        }),
        switchMap((driver) =>
          cameraService.initializeCamera(driver).pipe(
            switchMap((result) => {
              if (result.success) {
                // Fetch camera status after initialization
                return cameraService.getCameraStatus().pipe(
                  tap((camera) => {
                    patchState(store, {
                      currentCamera: camera,
                      isLoading: false,
                    });
                  }),
                );
              } else {
                patchState(store, {
                  error:
                    result.message || `Failed to initialize camera: ${driver}`,
                  isLoading: false,
                });
              }
              return of(null);
            }),
            catchError((error) => {
              const errorMessage =
                error?.message || `Failed to initialize camera: ${driver}`;
              console.error('[CameraStore] Error initializing camera:', error);
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    takePicture: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          cameraService.takePicture().pipe(
            tap((picture) => {
              patchState(store, { lastPicture: picture, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Failed to take picture';
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    startLiveView: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          cameraService.startLiveView().pipe(
            tap((result) => {
              if (result.success) {
                patchState(store, {
                  isLiveViewActive: true,
                  isLoading: false,
                });
              } else {
                patchState(store, {
                  error: result.message || 'Failed to start live view',
                  isLoading: false,
                });
              }
            }),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to start live view';
              console.error('[CameraStore] Error starting live view:', error);
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    stopLiveView: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          cameraService.stopLiveView().pipe(
            tap((result) => {
              if (result.success) {
                patchState(store, {
                  isLiveViewActive: false,
                  isLoading: false,
                  lastLiveFrame: null, // Clear last frame when stopping live view
                });
              }
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Failed to stop live view';
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    updateLiveFrame: (frame: LiveViewFrame) => {
      patchState(store, { lastLiveFrame: frame });
    },

    clearLiveFrame: () => {
      patchState(store, { lastLiveFrame: null });
    },

    /**
     * Upload a frame captured by the browser webcam (client camera) to the
     * server. The server saves it and broadcasts a pictureTaken event, so the
     * lastPicture is set both here and via the subscription.
     */
    uploadPhoto: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((imageData) =>
          cameraService.uploadPhoto(imageData).pipe(
            tap((picture) => {
              patchState(store, { lastPicture: picture, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Failed to upload photo';
              patchState(store, { error: errorMessage, isLoading: false });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    /**
     * Keeps the live-view WebSocket subscription alive at the store level so
     * individual components don't manage it — prevents the spinner flash when
     * navigating between layouts. Call with true to start, false to stop.
     */
    subscribeToLiveFrames: rxMethod<boolean>(
      pipe(
        distinctUntilChanged(),
        switchMap((active) => {
          if (!active) {
            patchState(store, { lastLiveFrame: null });
            return EMPTY;
          }
          return cameraService.subscribeLiveView().pipe(
            tap((frame) => patchState(store, { lastLiveFrame: frame })),
            catchError(() => EMPTY),
          );
        }),
      ),
    ),

    subscribeToPictures: rxMethod<void>(
      pipe(
        tap(() => console.log('[CameraStore] Subscribing to pictures')),
        switchMap(() =>
          cameraService.subscribePictureTaken().pipe(
            tap((picture) => {
              patchState(store, { lastPicture: picture });
            }),
            catchError((error) => {
              console.error('[CameraStore] Picture subscription error:', error);
              return of(null);
            }),
          ),
        ),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      // Subscribe to pictures whenever a server camera becomes active.
      effect(() => {
        const currentCamera = store.currentCamera();
        if (
          currentCamera &&
          currentCamera.available &&
          currentCamera.driver !== 'none'
        ) {
          store.subscribeToPictures();
        }
      });

      // Keep the live-view WebSocket in sync with isLiveViewActive.
      // Store-level subscription survives route changes — no spinner on layout switch.
      effect(() => {
        store.subscribeToLiveFrames(store.isLiveViewActive());
      });
    },
  }),
) {
  constructor() {
    super();
    // Auto-load available cameras on initialization
    this.loadAvailableCameras();
  }
}
