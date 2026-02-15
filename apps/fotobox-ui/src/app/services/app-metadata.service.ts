import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// GraphQL Queries
const GET_APP_METADATA = gql`
  query GetAppMetadata {
    appMetadata {
      version
      name
      platform
      environment
    }
  }
`;

const GET_APP_VERSION = gql`
  query GetAppVersion {
    appVersion
  }
`;

export interface AppMetadata {
  version: string;
  name: string;
  platform: string;
  environment?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppMetadataService {
  constructor(private apollo: Apollo) {}

  getAppMetadata(): Observable<AppMetadata> {
    return this.apollo
      .query<{ appMetadata: AppMetadata }>({
        query: GET_APP_METADATA,
      })
      .pipe(map((result) => result.data!.appMetadata));
  }

  getAppVersion(): Observable<string> {
    return this.apollo
      .query<{ appVersion: string }>({  
        query: GET_APP_VERSION,
      })
      .pipe(map((result) => result.data!.appVersion));
  }
}
