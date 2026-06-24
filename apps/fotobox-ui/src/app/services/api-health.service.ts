import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, retry, timeout, catchError } from 'rxjs';
import { of } from 'rxjs';
import { getGraphqlHttpUri } from '../api-config';

@Injectable({
  providedIn: 'root',
})
export class ApiHealthService {
  private readonly API_HEALTH_URL = getGraphqlHttpUri();
  private readonly RETRY_ATTEMPTS = 30;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly TIMEOUT = 5000; // 5 seconds

  constructor(private http: HttpClient) {}

  async waitForApiReady(): Promise<boolean> {
    try {
      // Try a simple POST request to the GraphQL endpoint with an invalid query
      // This will test connectivity without requiring valid schema
      await firstValueFrom(
        this.http
          .post<any>(this.API_HEALTH_URL, { query: '{ __typename }' })
          .pipe(
            timeout(this.TIMEOUT),
            retry({
              count: this.RETRY_ATTEMPTS,
              delay: () => {
                // Exponential backoff with jitter
                return new Promise((resolve) =>
                  setTimeout(resolve, this.RETRY_DELAY),
                );
              },
            }),
            catchError((error) => {
              console.error('API health check failed:', error);
              throw error;
            }),
          ),
      );
      return true;
    } catch (error) {
      console.error('API is not available after retries:', error);
      return false;
    }
  }

  isApiReachable(): Promise<boolean> {
    return this.waitForApiReady();
  }
}
