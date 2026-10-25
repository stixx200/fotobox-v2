import { CombinedGraphQLErrors } from '@apollo/client/errors';

/** A translatable, operator-friendly description of a failed API call. */
export interface ApiErrorDescription {
  /** ngx-translate key, e.g. `errors.network`. */
  key: string;
  params?: Record<string, unknown>;
  /** True when retrying the same call may help (connection problems). */
  retryable: boolean;
}

const CODE_PREFIX = 'MAIN.COLLAGE-EDITOR.';

const CODE_KEYS: Record<string, string> = {
  ALREADY_EXISTS: 'errors.alreadyExists',
  NOT_FOUND: 'errors.notFound',
  NO_DIRECTORY: 'errors.noDirectory',
  INVALID_DIRECTORY: 'errors.invalidDirectory',
  INVALID_TEMPLATE_ID: 'errors.invalidTemplateId',
  INVALID_ASSET: 'errors.invalidAsset',
  UNSUPPORTED_VERSION: 'errors.unsupportedVersion',
};

interface GraphqlErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

function graphqlErrors(error: unknown): GraphqlErrorLike[] {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors as GraphqlErrorLike[];
  }
  const legacy = (error as { graphQLErrors?: GraphqlErrorLike[] } | null)
    ?.graphQLErrors;
  return Array.isArray(legacy) ? legacy : [];
}

function httpStatus(error: unknown): number | undefined {
  const candidates = [
    error,
    (error as { networkError?: unknown } | null)?.networkError,
    (error as { cause?: unknown } | null)?.cause,
  ];
  for (const candidate of candidates) {
    const status = (candidate as { status?: unknown } | null)?.status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return undefined;
}

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  return String((error as { message?: unknown } | null)?.message ?? '');
}

/**
 * Map any error thrown by the GraphQL API service to a German/English
 * translation key. Raw technical messages are never shown to the operator –
 * they are only logged.
 */
export function describeApiError(
  error: unknown,
  fallbackKey = 'errors.unknown',
): ApiErrorDescription {
  for (const entry of graphqlErrors(error)) {
    const code = String(entry.extensions?.['code'] ?? '');
    if (code.startsWith(CODE_PREFIX)) {
      const key = CODE_KEYS[code.slice(CODE_PREFIX.length)];
      if (key) {
        const info = entry.extensions?.['info'] as
          | Record<string, unknown>
          | undefined;
        return { key, params: { ...(info ?? {}) }, retryable: false };
      }
    }
  }

  const status = httpStatus(error);
  if (status === 413) {
    return { key: 'errors.tooLarge', retryable: false };
  }
  const message = messageOf(error);
  if (
    status === 0 ||
    (status !== undefined && status >= 500) ||
    /Http failure|Failed to fetch|NetworkError|ECONNREFUSED|Unknown Error|timeout/i.test(
      message,
    )
  ) {
    return { key: 'errors.network', retryable: true };
  }
  if (/already exists/i.test(message)) {
    return { key: 'errors.alreadyExists', params: {}, retryable: false };
  }
  if (/not found/i.test(message)) {
    return { key: 'errors.notFound', retryable: false };
  }
  return { key: fallbackKey, retryable: true };
}
