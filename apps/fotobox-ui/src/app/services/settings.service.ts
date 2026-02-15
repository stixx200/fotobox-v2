import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// GraphQL Queries
const GET_SETTINGS = gql`
  query GetSettings {
    settings {
      items {
        key
        value
        description
      }
    }
  }
`;

const GET_SETTING = gql`
  query GetSetting($key: String!) {
    setting(key: $key) {
      key
      value
      description
    }
  }
`;

// GraphQL Mutations
const UPDATE_SETTING = gql`
  mutation UpdateSetting($input: SettingInput!) {
    updateSetting(input: $input) {
      key
      value
      description
    }
  }
`;

const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($input: SettingsInput!) {
    updateSettings(input: $input) {
      key
      value
      description
    }
  }
`;

const RESET_SETTINGS = gql`
  mutation ResetSettings {
    resetSettings {
      success
      message
    }
  }
`;

export interface Setting {
  key: string;
  value: string;
  description?: string;
}

export interface SettingInput {
  key: string;
  value: string;
}

export interface MutationResult {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  constructor(private apollo: Apollo) {}

  getAllSettings(): Observable<Setting[]> {
    return this.apollo
      .query<{ settings: { items: Setting[] } }>({
        query: GET_SETTINGS,
      })
      .pipe(map((result) => result.data!.settings.items));
  }

  getSetting(key: string): Observable<Setting | null> {
    return this.apollo
      .query<{ setting: Setting | null }>({  
        query: GET_SETTING,
        variables: { key },
      })
      .pipe(map((result) => result.data!.setting));
  }

  updateSetting(key: string, value: string): Observable<Setting> {
    return this.apollo
      .mutate<{ updateSetting: Setting }>({
        mutation: UPDATE_SETTING,
        variables: {
          input: { key, value },
        },
        refetchQueries: [{ query: GET_SETTINGS }],
      })
      .pipe(map((result) => result.data!.updateSetting));
  }

  updateSettings(settings: SettingInput[]): Observable<Setting[]> {
    return this.apollo
      .mutate<{ updateSettings: Setting[] }>({
        mutation: UPDATE_SETTINGS,
        variables: {
          input: { settings },
        },
        refetchQueries: [{ query: GET_SETTINGS }],
      })
      .pipe(map((result) => result.data!.updateSettings));
  }

  resetSettings(): Observable<MutationResult> {
    return this.apollo
      .mutate<{ resetSettings: MutationResult }>({
        mutation: RESET_SETTINGS,
        refetchQueries: [{ query: GET_SETTINGS }],
      })
      .pipe(map((result) => result.data!.resetSettings));
  }
}
