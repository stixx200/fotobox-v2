import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { describeApiError } from './api-error';

describe('describeApiError', () => {
  it('maps an unreachable API (HTTP status 0) to a retryable network error', () => {
    const error = Object.assign(
      new Error(
        'Http failure response for http://localhost:5100/graphql: 0 Unknown Error',
      ),
      { status: 0 },
    );
    expect(describeApiError(error)).toEqual({
      key: 'errors.network',
      retryable: true,
    });
  });

  it('maps known API error codes', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: "Template 'x' already exists.",
          extensions: {
            code: 'MAIN.COLLAGE-EDITOR.ALREADY_EXISTS',
            info: { id: 'x' },
          },
        },
      ],
    });
    expect(describeApiError(error)).toEqual({
      key: 'errors.alreadyExists',
      params: { id: 'x' },
      retryable: false,
    });
  });

  it('maps a missing template', () => {
    expect(describeApiError(new Error('Project not found')).key).toBe(
      'errors.notFound',
    );
  });

  it('falls back to the given key and never exposes the raw message', () => {
    expect(describeApiError(new Error('boom'), 'errors.saveFailed')).toEqual({
      key: 'errors.saveFailed',
      retryable: true,
    });
  });
});
