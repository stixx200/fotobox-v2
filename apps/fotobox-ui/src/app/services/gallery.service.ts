import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { requireData } from './graphql-result';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface PhotoInfo {
  id: string;
  path: string;
  timestamp: string;
}

const LIST_PHOTOS = gql`
  query Photos {
    photos {
      id
      path
      timestamp
    }
  }
`;

const DELETE_PHOTO = gql`
  mutation DeletePhoto($photoId: String!) {
    deletePhoto(photoId: $photoId)
  }
`;

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private readonly apollo = inject(Apollo);

  listPhotos(): Observable<PhotoInfo[]> {
    return this.apollo
      .query<{ photos: PhotoInfo[] }>({
        query: LIST_PHOTOS,
        fetchPolicy: 'no-cache',
      })
      .pipe(map((result) => requireData(result).photos ?? []));
  }

  deletePhoto(photoId: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deletePhoto: boolean }>({
        mutation: DELETE_PHOTO,
        variables: { photoId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.deletePhoto) {
            throw new Error('Photo could not be deleted');
          }
          return true;
        }),
      );
  }
}
