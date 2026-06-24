import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// GraphQL Queries
const GET_AVAILABLE_PRINTERS = gql`
  query GetAvailablePrinters {
    availablePrinters {
      items {
        name
        description
        state
        isDefault
      }
      count
    }
  }
`;

export interface PrinterInfo {
  name: string;
  description?: string;
  state?: string;
  isDefault?: boolean;
}

export interface PrinterList {
  items: PrinterInfo[];
  count: number;
}

@Injectable({
  providedIn: 'root',
})
export class PrinterService {
  constructor(private apollo: Apollo) {}

  getAvailablePrinters(): Observable<PrinterInfo[]> {
    return this.apollo
      .query<{ availablePrinters: PrinterList }>({
        query: GET_AVAILABLE_PRINTERS,
      })
      .pipe(map((result) => result.data!.availablePrinters.items));
  }
}
