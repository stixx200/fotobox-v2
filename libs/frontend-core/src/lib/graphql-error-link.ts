import { onError } from '@apollo/client/link/error';

export function createGraphqlErrorLink() {
  return onError((errorResponse) => {
    const { graphQLErrors, networkError } = errorResponse as {
      graphQLErrors?: { message: string }[];
      networkError?: Error;
    };
    graphQLErrors?.forEach((err) => console.error('[GraphQL]', err.message));
    if (networkError) {
      console.error('[Network]', networkError.message);
    }
  });
}
