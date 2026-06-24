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
  PrinterService,
  PrinterInfo,
} from '../services/printer.service';

type PrinterState = {
  availablePrinters: PrinterInfo[];
  isLoading: boolean;
  error: string | null;
};

@Injectable({ providedIn: 'root' })
export class PrinterStore extends signalStore(
  withState<PrinterState>({
    availablePrinters: [],
    isLoading: false,
    error: null,
  }),
  withComputed((state) => ({
    printerNames: computed(() =>
      state.availablePrinters().map((printer) => printer.name)
    ),
    hasAvailablePrinters: computed(() => state.availablePrinters().length > 0),
    defaultPrinter: computed(() =>
      state.availablePrinters().find((p) => p.isDefault)?.name ?? null
    ),
  })),
  withMethods((store, printerService = inject(PrinterService)) => ({
    loadAvailablePrinters: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          printerService.getAvailablePrinters().pipe(
            tap((printers) =>
              patchState(store, {
                availablePrinters: printers,
                isLoading: false,
              })
            ),
            catchError((error) => {
              const errorMessage =
                error?.message || 'Failed to load available printers';
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
) {}
