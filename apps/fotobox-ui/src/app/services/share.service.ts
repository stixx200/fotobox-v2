import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ShareLink {
  url: string;
  token: string;
  expiresAt: string;
}

const CREATE_SHARE_LINK = gql`
  mutation CreateShareLink($filename: String!) {
    createShareLink(filename: $filename) {
      url
      token
      expiresAt
    }
  }
`;

const DETECTED_SHARE_BASE_URL = gql`
  query DetectedShareBaseUrl {
    detectedShareBaseUrl
  }
`;

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly apollo = inject(Apollo);

  createShareLink(photoUrl: string): Observable<ShareLink> {
    const filename = this.extractFilename(photoUrl);
    return this.apollo
      .mutate<{ createShareLink: ShareLink }>({
        mutation: CREATE_SHARE_LINK,
        variables: { filename },
      })
      .pipe(
        map((result) => {
          const link = result.data?.createShareLink;
          if (!link) {
            throw new Error('Failed to create share link');
          }
          return link;
        }),
      );
  }

  getDetectedShareBaseUrl(): Observable<string> {
    return this.apollo
      .query<{ detectedShareBaseUrl: string }>({
        query: DETECTED_SHARE_BASE_URL,
        fetchPolicy: 'no-cache',
      })
      .pipe(map((result) => result.data?.detectedShareBaseUrl ?? ''));
  }

  /** Extract the on-disk filename from a photo URL or server-relative path. */
  extractFilename(photoUrl: string): string {
    const withoutQuery = photoUrl.split('?')[0] ?? photoUrl;
    const segments = withoutQuery.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) {
      throw new Error('Invalid photo URL');
    }
    return decodeURIComponent(last);
  }
}
