import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';

// GraphQL Queries
const GET_AVAILABLE_LAYOUT_IDS = gql`
  query GetAvailableLayoutIds($collageDirectory: String) {
    availableLayoutIds(collageDirectory: $collageDirectory)
  }
`;

const GET_LAYOUT_PREVIEW = gql`
  query GetLayoutPreview($layoutId: String!, $collageDirectory: String) {
    layoutPreview(layoutId: $layoutId, collageDirectory: $collageDirectory)
  }
`;

@Injectable({
  providedIn: 'root',
})
export class CollageService {
  constructor(private apollo: Apollo) {}

  getAvailableLayoutIds(collageDirectory?: string): Observable<string[]> {
    return this.apollo
      .query<{ availableLayoutIds: string[] }>({
        query: GET_AVAILABLE_LAYOUT_IDS,
        variables: { collageDirectory: collageDirectory || null },
        fetchPolicy: 'network-only',
      })
      .pipe(
        // map to just the array of layout IDs
        (result$) =>
          new Observable<string[]>((observer) => {
            const subscription = result$.subscribe({
              next: (result) => {
                observer.next(
                  result.data?.availableLayoutIds || ['Einzelbild'],
                );
                observer.complete();
              },
              error: (error) => {
                console.error('Error fetching available layouts:', error);
                observer.error(error);
              },
            });
            return subscription;
          }),
      );
  }

  /**
   * Get preview image URL for a specific layout
   * @param layoutId The layout ID to get preview for
   * @param collageDirectory Optional collage directory path
   * @returns Observable with the preview image URL (data URL or asset path)
   */
  getLayoutPreview(
    layoutId: string,
    collageDirectory?: string,
  ): Observable<string> {
    return this.apollo
      .query<{ layoutPreview: string }>({
        query: GET_LAYOUT_PREVIEW,
        variables: {
          layoutId,
          collageDirectory: collageDirectory || null,
        },
        fetchPolicy: 'network-only',
      })
      .pipe(
        (result$) =>
          new Observable<string>((observer) => {
            const subscription = result$.subscribe({
              next: (result) => {
                observer.next(
                  result.data?.layoutPreview || '/collagelayout.preview.jpg',
                );
                observer.complete();
              },
              error: (error) => {
                console.error('Error fetching layout preview:', error);
                observer.next('/collagelayout.preview.jpg');
                observer.complete();
              },
            });
            return subscription;
          }),
      );
  }
}
