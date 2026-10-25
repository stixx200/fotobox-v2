import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { requireData } from './graphql-result';
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
  private readonly apollo = inject(Apollo);

  getAvailablePrinters(): Observable<PrinterInfo[]> {
    return this.apollo
      .query<{ availablePrinters: PrinterList }>({
        query: GET_AVAILABLE_PRINTERS,
      })
      .pipe(map((result) => requireData(result).availablePrinters.items));
  }
}
