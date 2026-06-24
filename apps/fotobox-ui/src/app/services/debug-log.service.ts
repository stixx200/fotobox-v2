import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

export interface ServerLogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string | null;
  metaJson?: string | null;
}

const GET_RECENT_LOGS = gql`
  query RecentLogs($limit: Int) {
    recentLogs(limit: $limit) {
      total
      entries {
        timestamp
        level
        message
        context
        metaJson
      }
    }
  }
`;

const CLEAR_LOGS = gql`
  mutation ClearLogs {
    clearLogs {
      success
      message
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class DebugLogService {
  constructor(private readonly apollo: Apollo) {}

  getRecentLogs(limit = 200): Observable<ServerLogEntry[]> {
    return this.apollo
      .query<{ recentLogs: { entries: ServerLogEntry[] } }>({
        query: GET_RECENT_LOGS,
        variables: { limit },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.recentLogs.entries ?? []));
  }

  clearServerLogs(): Observable<boolean> {
    return this.apollo
      .mutate<{ clearLogs: { success: boolean } }>({
        mutation: CLEAR_LOGS,
      })
      .pipe(map((result) => result.data?.clearLogs.success ?? false));
  }
}
