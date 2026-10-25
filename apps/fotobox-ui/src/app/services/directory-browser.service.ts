import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { requireData } from './graphql-result';

const BROWSE_DIRECTORY = gql`
  query BrowseDirectory($path: String) {
    browseDirectory(path: $path) {
      path
      parent
      roots
      entries {
        name
        path
      }
    }
  }
`;

export interface DirectoryListing {
  path: string;
  parent: string | null;
  roots: string[];
  entries: { name: string; path: string }[];
}

/** Folder listing on the host, for the settings folder picker. */
@Injectable({ providedIn: 'root' })
export class DirectoryBrowserService {
  private readonly apollo = inject(Apollo);

  browse(path?: string | null): Observable<DirectoryListing> {
    return this.apollo
      .query<{ browseDirectory: DirectoryListing }>({
        query: BROWSE_DIRECTORY,
        variables: { path: path || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => requireData(result).browseDirectory));
  }
}
