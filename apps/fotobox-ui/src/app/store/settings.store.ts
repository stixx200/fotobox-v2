import { computed, inject, Injectable } from '@angular/core';
import {
  signalStore,
  withState,
  patchState,
  withMethods,
  withComputed,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import { SettingsService, Setting } from '../services/settings.service';

type SettingsState = {
  settings: Setting[];
  isLoading: boolean;
  error: string | null;
  selectedSetting: Setting | null;
};

@Injectable({ providedIn: 'root' })
export class SettingsStore extends signalStore(
  withState<SettingsState>({
    settings: [],
    isLoading: false,
    error: null,
    selectedSetting: null,
  }),
  withComputed(({ settings, isLoading, error, selectedSetting }) => ({
    settingsCount: computed(() => settings().length),
    settingsMap: computed(() => {
      const settingsArray = settings();
      return settingsArray.reduce(
        (acc, setting) => {
          acc[setting.key] = setting;
          return acc;
        },
        {} as Record<string, Setting>,
      );
    }),
    activeLayouts: computed(() => {
      const layoutsSetting = settings().find((s) => s.key === 'layouts');
      if (!layoutsSetting) {
        return [] as string[];
      }
      try {
        const parsed = JSON.parse(layoutsSetting.value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [] as string[];
      }
    }),
  })),
  withMethods((store, settingsService = inject(SettingsService)) => ({
    loadSettings: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: null });
        }),
        switchMap(() =>
          settingsService.getAllSettings().pipe(
            tap((settings) => {
              patchState(store, { settings, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Failed to load settings';
              console.error('SettingsStore: Error loading settings:', error);
              patchState(store, { error: errorMessage, isLoading: false });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    loadSetting: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((key) =>
          settingsService.getSetting(key).pipe(
            tap((setting) => {
              patchState(store, {
                selectedSetting: setting,
                isLoading: false,
              });
            }),
            catchError((error) => {
              const errorMessage =
                error?.message || `Failed to load setting: ${key}`;
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

    updateSetting: rxMethod<{ key: string; value: string }>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(({ key, value }) =>
          settingsService.updateSetting(key, value).pipe(
            tap((updatedSetting) => {
              const settings = store
                .settings()
                .map((s) => (s.key === key ? updatedSetting : s));
              patchState(store, {
                settings,
                isLoading: false,
              });
            }),
            catchError((error) => {
              const errorMessage =
                error?.message || `Failed to update setting: ${key}`;
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

    updateSettings: rxMethod<Array<{ key: string; value: string }>>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((settingsArray) =>
          settingsService.updateSettings(settingsArray).pipe(
            tap((updatedSettings) =>
              patchState(store, {
                settings: updatedSettings,
                isLoading: false,
              }),
            ),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to update settings';
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

    resetSettings: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { isLoading: true, error: null });
        }),
        switchMap(() =>
          settingsService.resetSettings().pipe(
            switchMap(() => settingsService.getAllSettings()),
            tap((settings) => {
              patchState(store, { settings, isLoading: false });
            }),
            catchError((error) => {
              const errorMessage = error?.message || 'Failed to reset settings';
              console.error('Store: resetSettings error:', error);
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
  })),
) {
  constructor() {
    super();
    // Auto-load settings on initialization
    this.loadSettings();
  }
}
