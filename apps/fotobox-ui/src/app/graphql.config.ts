import {
  ApolloClientOptions,
  InMemoryCache,
  split,
  ApolloLink,
  HttpLink,
} from '@apollo/client/core';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { createClient } from 'graphql-ws';
import { GraphQLError } from 'graphql';
import { getGraphqlHttpUri, getGraphqlWsUri } from './api-config';
import { ClientLogService } from './services/client-log.service';
import { RecoveryService } from './services/recovery.service';

export function createApolloOptions(
  clientLog?: ClientLogService,
  recovery?: RecoveryService,
): ApolloClientOptions {
  // Create HTTP link for queries and mutations
  const http = new HttpLink({
    uri: getGraphqlHttpUri(),
  });

  // Create WebSocket link for subscriptions
  const ws = new GraphQLWsLink(
    createClient({
      url: getGraphqlWsUri(),
      connectionParams: () => ({
        // Add any auth headers here if needed
      }),
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
        closed: () => {},
      },
    }),
  );

  const errorLink = onError((errorResponse) => {
    const { graphQLErrors, networkError, operation } = errorResponse as {
      graphQLErrors?: GraphQLError[];
      networkError?: Error;
      operation?: { operationName?: string };
    };

    if (graphQLErrors) {
      graphQLErrors.forEach((error: GraphQLError) => {
        const detail = {
          message: error.message,
          path: error.path,
          extensions: error.extensions,
          operation: operation?.operationName,
        };
        console.error('[GraphQL error]', detail);
        clientLog?.error(`GraphQL: ${error.message}`, detail);
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`, networkError);
      clientLog?.error(`Network: ${networkError.message}`, networkError);
      recovery?.reportNetworkError(networkError.message);
    }
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
