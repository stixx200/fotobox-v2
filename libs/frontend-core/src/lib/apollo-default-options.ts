/**
 * Apollo Client 4 requires default options that change result types (here
 * `errorPolicy: 'all'`, used by both UIs) to be declared up front, so results
 * are typed with possibly missing `data` and partial `error` fields.
 */
/* eslint-disable @typescript-eslint/no-namespace -- Apollo's DeclareDefaultOptions is a namespace; augmentation must mirror it */
declare module '@apollo/client' {
  export namespace ApolloClient {
    export namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy?: 'none' | 'all' | 'ignore';
      }
      interface Query {
        errorPolicy?: 'none' | 'all' | 'ignore';
      }
      interface Mutate {
        errorPolicy?: 'none' | 'all' | 'ignore';
      }
    }
  }
}

export {};
