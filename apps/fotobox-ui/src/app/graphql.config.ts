import { ApolloClientOptions, InMemoryCache, split, ApolloLink, HttpLink } from '@apollo/client/core';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { createClient } from 'graphql-ws';
import { GraphQLError } from 'graphql';

const GRAPHQL_URI = 'http://localhost:3000/api/graphql';
const WS_URI = 'ws://localhost:3000/api/graphql';

export function createApolloOptions() {
  // Create HTTP link for queries and mutations
  const http = new HttpLink({
    uri: GRAPHQL_URI,
  });

  // Create WebSocket link for subscriptions
  const ws = new GraphQLWsLink(
    createClient({
      url: WS_URI,
      connectionParams: () => ({
        // Add any auth headers here if needed
      }),
      on: {
        error: (error) => {
          console.error('WebSocket error:', error);
        },
        connected: () => {
          console.log('WebSocket connected');
        },
        closed: () => {
          console.log('WebSocket closed');
        },
      },
    })
  );

  // Error handling link
  const errorLink = onError((errorResponse) => {
    const { graphQLErrors, networkError, operation } = errorResponse as any;
    if (graphQLErrors) {
      graphQLErrors.forEach((error: GraphQLError) => {
        console.error(
          `[GraphQL error]: Message: ${error.message}, Location: ${JSON.stringify(error.locations)}, Path: ${error.path}`,
          error.extensions
        );
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`, networkError);
    }

    if (operation) {
      console.error(`[Operation]: ${operation.operationName}`);
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
    ws,  // Use WebSocket for subscriptions
    http // Use HTTP for queries and mutations
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
