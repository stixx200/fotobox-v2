import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type Client } from 'graphql-ws';
import WebSocket from 'ws';
import { bootstrapApiServer } from '@fotobox/nest-api';

/**
 * Test-only header: pretend the request comes from this (LAN) address. Only
 * the listener installed by {@link startApi} reads it; the production server
 * never looks at it. The real client is always 127.0.0.1, so this is the only
 * deterministic way to exercise the non-loopback branch on any machine.
 */
export const FAKE_REMOTE_ADDRESS_HEADER = 'x-test-remote-address';

export const testDirs = {
  get root(): string {
    return requireEnv('FOTOBOX_IT_ROOT');
  },
  get photos(): string {
    return requireEnv('FOTOBOX_PHOTO_DIR');
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} not set — is integration/support/isolated-env.ts a setup file?`,
    );
  }
  return value;
}

export interface GraphqlResponse<T = Record<string, unknown>> {
  status: number;
  data?: T | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

export interface TestApi {
  app: INestApplication;
  baseUrl: string;
  wsUrl: string;
  gql<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<GraphqlResponse<T>>;
  /** gql() that fails the test on HTTP or GraphQL errors. */
  gqlOk<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T>;
  wsClient(options?: {
    headers?: Record<string, string>;
    connectionParams?: Record<string, unknown>;
  }): Client;
  close(): Promise<void>;
}

function spoofRemoteAddress(request: IncomingMessage): void {
  const fake = request.headers[FAKE_REMOTE_ADDRESS_HEADER];
  if (typeof fake === 'string' && fake) {
    Object.defineProperty(request.socket, 'remoteAddress', {
      value: fake,
      configurable: true,
    });
  }
}

/**
 * Boot the real API (same bootstrap as `main.ts`) on an ephemeral loopback
 * port. `env` is applied before bootstrap and restored on close().
 */
export async function startApi(
  env: Record<string, string | undefined> = {},
): Promise<TestApi> {
  const previousEnv: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(env)) {
    previousEnv[name] = process.env[name];
    setEnv(name, value);
  }

  let app: INestApplication;
  try {
    app = await bootstrapApiServer({ port: 0, host: '127.0.0.1' });
  } catch (error) {
    restoreEnv(previousEnv);
    throw error;
  }

  const server = app.getHttpServer() as Server;
  server.prependListener('request', spoofRemoteAddress);
  server.prependListener('upgrade', spoofRemoteAddress);
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/graphql`;
  const wsClients: Client[] = [];

  const gql: TestApi['gql'] = async (query, variables, headers = {}) => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ query, variables }),
    });
    const text = await response.text();
    let body: Omit<GraphqlResponse, 'status'>;
    try {
      body = JSON.parse(text);
    } catch {
      body = { errors: [{ message: text }] };
    }
    return { status: response.status, ...body } as GraphqlResponse<never>;
  };

  return {
    app,
    baseUrl,
    wsUrl,
    gql,
    async gqlOk<T>(query: string, variables?: Record<string, unknown>) {
      const result = await gql<T>(query, variables);
      if (result.status !== 200 || result.errors?.length || !result.data) {
        throw new Error(
          `GraphQL request failed (${result.status}): ${JSON.stringify(result.errors)}`,
        );
      }
      return result.data;
    },
    wsClient(options = {}) {
      const client = createClient({
        url: wsUrl,
        lazy: true,
        retryAttempts: 0,
        connectionParams: options.connectionParams,
        webSocketImpl: class extends WebSocket {
          constructor(address: string, protocols?: string | string[]) {
            super(address, protocols, { headers: options.headers });
          }
        },
      });
      wsClients.push(client);
      return client;
    },
    async close() {
      await Promise.all(wsClients.map((client) => client.dispose()));
      // Don't wait for keep-alive / unread responses to time out.
      server.closeAllConnections();
      await app.close();
      restoreEnv(previousEnv);
    },
  };
}

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(previous)) {
    setEnv(name, value);
  }
}
