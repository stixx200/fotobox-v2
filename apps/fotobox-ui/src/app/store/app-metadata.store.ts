import {
  computed,
  inject,
  Injectable,
} from '@angular/core';
import {
  signalStore,
  withState,
  patchState,
  withMethods,
  withComputed,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import {
  AppMetadataService,
  AppMetadata,
} from '../services/app-metadata.service';

type AppMetadataState = {
  version: string | null;
  metadata: AppMetadata | null;
  isLoading: boolean;
  error: string | null;
};

@Injectable({ providedIn: 'root' })
export class AppMetadataStore extends signalStore(
  withState<AppMetadataState>({
    version: null,
    metadata: null,
    isLoading: false,
    error: null,
  }),
  withComputed(({ version, metadata, isLoading, error }) => ({
    displayVersion: computed(() => {
      const v = version();
      return v ? `v${v}` : 'Unknown';
    }),
    appInfo: computed(() => ({
      version: version(),
      metadata: metadata(),
    })),
  })),
  withMethods((store, appMetadataService = inject(AppMetadataService)) => ({
    loadVersion: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          appMetadataService.getAppVersion().pipe(
            tap((version) =>
              patchState(store, { version, isLoading: false })
            ),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to load app version';
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            })
          )
        )
      )
    ),

    loadMetadata: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          appMetadataService.getAppMetadata().pipe(
            tap((metadata) =>
              patchState(store, { metadata, isLoading: false })
            ),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to load app metadata';
              patchState(store, {
                error: errorMessage,
                isLoading: false,
              });
              return of(null);
            })
          )
        )
      )
    ),
  }))
) {
  constructor() {
    super();
    // Auto-load version and metadata on initialization
    this.loadVersion();
    this.loadMetadata();
  }
}
