export interface ErrorOptions {
  cause?: Error;
  code?: string;
  info?: Record<string, unknown>;
}

export class FotoboxError extends Error {
  code?: string;
  info: Record<string, unknown>;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = 'FotoboxError';
    this.cause = options?.cause;
    this.code = options?.code;
    this.info = options?.info || {};
  }
}
