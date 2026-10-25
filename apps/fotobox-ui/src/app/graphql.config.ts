import {
  ApolloClientOptions,
  CombinedGraphQLErrors,
  InMemoryCache,
  split,
  ApolloLink,
  HttpLink,
} from '@apollo/client/core';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { createClient } from 'graphql-ws';
import {
  getApiAuthHeaders,
  getGraphqlHttpUri,
  getGraphqlWsUri,
  resolveApiToken,
} from './api-config';
import { ClientLogService } from './services/client-log.service';
import { RecoveryService } from './services/recovery.service';

export function createApolloOptions(
  clientLog?: ClientLogService,
  recovery?: RecoveryService,
): ApolloClientOptions {
  // Create HTTP link for queries and mutations
  const http = new HttpLink({
    uri: getGraphqlHttpUri(),
    headers: getApiAuthHeaders(),
  });

  // Create WebSocket link for subscriptions
  const ws = new GraphQLWsLink(
    createClient({
      url: getGraphqlWsUri(),
      connectionParams: () => {
        const token = resolveApiToken();
        return token ? { token } : {};
      },
      on: {
        error: (error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error('WebSocket error:', error);
          clientLog?.error('WebSocket error', message);
        },
        connected: () => {
          recovery?.clearNetworkDegraded();
        },
      },
    }),
  );

  // Apollo Client 4 passes a single `error`: GraphQL errors come as
  // CombinedGraphQLErrors, anything else means the API was not reached.
  const errorLink = onError(({ error, operation }) => {
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach((graphQLError) => {
        const detail = {
          message: graphQLError.message,
          path: graphQLError.path,
          extensions: graphQLError.extensions,
          operation: operation.operationName,
        };
        console.error('[GraphQL error]', detail);
        clientLog?.error(`GraphQL: ${graphQLError.message}`, detail);
      });
      return;
    }

    console.error(`[Network error]: ${error.message}`, error);
    clientLog?.error(`Network: ${error.message}`, error);
    recovery?.reportNetworkError(error.message);
  });

  // Split traffic based on operation type
  const link = split(
    // Split based on operation type
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    ws, // Use WebSocket for subscriptions
    http, // Use HTTP for queries and mutations
  );

  // Combine error link with split link
  const combinedLink = ApolloLink.from([errorLink, link]);

  return {
    link: combinedLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network' as const,
        errorPolicy: 'all' as const,
      },
      query: {
        fetchPolicy: 'network-only' as const,
        errorPolicy: 'all' as const,
      },
      mutate: {
        errorPolicy: 'all' as const,
      },
    },
  };
}
