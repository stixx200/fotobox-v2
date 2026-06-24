import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

export interface CollageResult {
  id: string;
  path: string;
  timestamp: string;
}

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

const GET_REQUIRED_COLLAGE_PHOTOS = gql`
  query RequiredCollagePhotos($templateId: String!, $collageDirectory: String) {
    requiredCollagePhotos(
      templateId: $templateId
      collageDirectory: $collageDirectory
    )
  }
`;

const START_COLLAGE = gql`
  mutation StartCollage($input: CreateCollageInput!) {
    startCollage(input: $input) {
      success
      message
    }
  }
`;

const ADD_PHOTO_TO_COLLAGE = gql`
  mutation AddPhotoToCollage($input: AddPhotoInput!) {
    addPhotoToCollage(input: $input) {
      success
      message
    }
  }
`;

const FINALIZE_COLLAGE = gql`
  mutation FinalizeCollage {
    finalizeCollage {
      id
      path
      timestamp
    }
  }
`;

const RESET_COLLAGE = gql`
  mutation ResetCollage {
    resetCollage {
      success
      message
    }
  }
`;

const GET_COLLAGE_PREVIEW = gql`
  query CollagePreview {
    collagePreview
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

  /**
   * Number of photos required for a collage template.
   */
  getRequiredPhotoCount(
    templateId: string,
    collageDirectory?: string,
  ): Observable<number> {
    return this.apollo
      .query<{ requiredCollagePhotos: number }>({
        query: GET_REQUIRED_COLLAGE_PHOTOS,
        variables: { templateId, collageDirectory: collageDirectory || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.requiredCollagePhotos ?? 0));
  }

  /**
   * Start a new collage with the given template.
   */
  startCollage(templateId: string): Observable<boolean> {
    return this.apollo
      .mutate<{ startCollage: { success: boolean; message: string } }>({
        mutation: START_COLLAGE,
        variables: { input: { templateId } },
      })
      .pipe(map((result) => result.data?.startCollage.success ?? false));
  }

  /**
   * Add a captured photo (filename relative to the photo directory) to the
   * in-progress collage.
   */
  addPhotoToCollage(photoPath: string): Observable<boolean> {
    return this.apollo
      .mutate<{ addPhotoToCollage: { success: boolean; message: string } }>({
        mutation: ADD_PHOTO_TO_COLLAGE,
        variables: { input: { photoPath } },
      })
      .pipe(map((result) => result.data?.addPhotoToCollage.success ?? false));
  }

  /**
   * Render and persist the in-progress collage, returning the saved result.
   */
  finalizeCollage(): Observable<CollageResult> {
    return this.apollo
      .mutate<{ finalizeCollage: CollageResult }>({
        mutation: FINALIZE_COLLAGE,
      })
      .pipe(
        map((result) => {
          const collage = result.data?.finalizeCollage;
          if (!collage) {
            throw new Error('Failed to finalize collage');
          }
          return collage;
        }),
      );
  }

  /**
   * Reset / abort the current collage.
   */
  resetCollage(): Observable<boolean> {
    return this.apollo
      .mutate<{ resetCollage: { success: boolean; message: string } }>({
        mutation: RESET_COLLAGE,
      })
      .pipe(map((result) => result.data?.resetCollage.success ?? false));
  }

  /**
   * Render the current partial collage (photos taken so far + questionmarks
   * for empty slots) and return it as a base64 JPEG data URL.
   * Returns null when no collage is in progress.
   */
  getCollagePreview(): Observable<string | null> {
    return this.apollo
      .query<{ collagePreview: string | null }>({
        query: GET_COLLAGE_PREVIEW,
        fetchPolicy: 'no-cache',
      })
      .pipe(map((result) => result.data?.collagePreview ?? null));
  }
}
