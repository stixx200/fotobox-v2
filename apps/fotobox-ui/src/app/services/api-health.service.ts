import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { getApiAuthHeaders, getGraphqlHttpUri } from '../api-config';

/**
 * How long the UI waits for the API. The first start on a kiosk PC can take
 * minutes (virus scan of the bundled API files, database migrations).
 */
export const API_STARTUP_TIMEOUT_MS = 180_000;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 5000;

@Injectable({
  providedIn: 'root',
})
export class ApiHealthService {
  private readonly API_HEALTH_URL = getGraphqlHttpUri();

  private readonly http = inject(HttpClient);

  /** Polls the API until it answers or `timeoutMs` has passed. */
  async waitForApiReady(timeoutMs = API_STARTUP_TIMEOUT_MS): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (await this.isApiReachable()) {
        return true;
      }
      if (Date.now() >= deadline) {
        console.error(`API not available after ${timeoutMs / 1000} s`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  /** One `{ __typename }` request to the GraphQL endpoint. */
  async isApiReachable(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http
          .post<unknown>(
            this.API_HEALTH_URL,
            { query: '{ __typename }' },
            { headers: getApiAuthHeaders() },
          )
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
      );
      return true;
    } catch {
      return false;
    }
  }
}
