/**
 * Returns the `data` payload of an Apollo operation result, failing the
 * observable with a descriptive error when the server returned no data
 * (e.g. because of a GraphQL error with `errorPolicy: 'none'`).
 */
export function requireData<T>(result: { data?: T | null }): T {
  const { data } = result;
  if (data === undefined || data === null) {
    throw new Error('GraphQL operation returned no data');
  }
  return data;
}
