import { inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { InMemoryCache, ApolloLink } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import {
  createGraphqlErrorLink,
  getApiAuthHeaders,
} from '@fotobox/frontend-core';
import { getGraphqlHttpUri } from './api-config';

export function createApolloOptions() {
  const httpLink = inject(HttpLink);
  return {
    link: ApolloLink.from([
      createGraphqlErrorLink(),
      httpLink.create({
        uri: getGraphqlHttpUri(),
        headers: new HttpHeaders(getApiAuthHeaders()),
      }),
    ]),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'network-only' as const },
      mutate: { errorPolicy: 'all' as const },
    },
  };
}
