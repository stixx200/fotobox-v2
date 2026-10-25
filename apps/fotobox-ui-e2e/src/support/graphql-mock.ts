import type { Page, Route, WebSocketRoute } from '@playwright/test';

type GraphqlBody = {
  operationName?: string;
  query?: string;
  variables?: Record<string, unknown>;
};

type Variables = Record<string, unknown>;

/** A GraphQL response body as the API would send it. */
export type GraphqlResponse = {
  data?: Record<string, unknown> | null;
  errors?: { message: string }[];
};

/**
 * Answers one operation. Returning `'abort'` drops the request like an
 * unreachable API would.
 */
export type OperationHandler = (
  variables: Variables,
) => GraphqlResponse | 'abort' | Promise<GraphqlResponse | 'abort'>;

/** One GraphQL request the UI sent over HTTP. */
export type GraphqlCall = { operation: string; variables: Variables };

/** The API serves photos from here; the mock answers with a tiny JPEG. */
const API_ORIGIN = 'http://localhost:5100';

const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD/9k=';

const TINY_JPEG_DATA_URL = `data:image/jpeg;base64,${TINY_JPEG}`;

const DEFAULT_SETTINGS = [
  { key: 'shutterTimeout', value: '5', description: 'Shutter timeout' },
  { key: 'usePrinter', value: 'true', description: 'Use printer' },
  { key: 'useShare', value: 'false', description: 'Use share' },
  { key: 'shareBaseUrl', value: '""', description: 'Share base URL' },
  {
    key: 'shareTokenExpiryHours',
    value: '24',
    description: 'Share token expiry',
  },
  { key: 'printerName', value: '"printer1"', description: 'Printer name' },
  { key: 'showPrintDialog', value: 'false', description: 'Show print dialog' },
  {
    key: 'photoDirectory',
    value: '"/tmp/photos"',
    description: 'Photo directory',
  },
  { key: 'collageDirectory', value: '""', description: 'Collage directory' },
  { key: 'layouts', value: '["Einzelbild"]', description: 'Active layouts' },
  { key: 'camera', value: '"demo"', description: 'Camera driver' },
  { key: 'galleryPassword', value: '""', description: 'Gallery PIN' },
  {
    key: 'showGalleryButton',
    value: 'false',
    description: 'Show gallery button',
  },
  { key: 'operatorPin', value: '""', description: 'Operator PIN' },
  { key: 'autoStart', value: 'false', description: 'Auto-start' },
];

const DEMO_CAMERA = {
  driver: 'demo',
  status: 'ready',
  available: true,
  location: 'server',
  capabilities: { liveView: true },
};

const OK = { success: true, message: null };

function resolveOperationName(body: GraphqlBody): string {
  if (body.operationName) {
    return body.operationName;
  }
  const match = body.query?.match(/(?:query|mutation)\s+(\w+)/);
  return match?.[1] ?? '';
}

/** The API health probe sends exactly `{ __typename }`; Apollo adds
 * `__typename` to every selection set, so match the whole query. */
function isTypenameHealthCheck(body: GraphqlBody): boolean {
  return /^\s*(query\s*)?\{\s*__typename\s*\}\s*$/.test(body.query ?? '');
}

/**
 * In-memory stand-in for the Fotobox API: GraphQL over HTTP, the graphql-ws
 * subscription socket and the photo files. Tests tweak it per case with
 * {@link setSettings}, {@link handle}, {@link fail} and {@link setOffline}.
 */
export class FotoboxUiGraphqlMock {
  private settingOverrides: Record<string, string> = {};
  private readonly handlers = new Map<string, OperationHandler>();
  private readonly sockets = new Set<WebSocketRoute>();
  /** Sockets opened while offline; acknowledged once the API is back. */
  private readonly pendingSockets = new Set<WebSocketRoute>();
  private pictureCount = 0;
  private offline = false;

  /** Every GraphQL request the UI sent over HTTP, in order. */
  readonly calls: GraphqlCall[] = [];

  constructor(private readonly page: Page) {}

  /** Override setting values (JSON-encoded like the API) for this test. */
  setSettings(overrides: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(overrides)) {
      this.settingOverrides[key] = JSON.stringify(value);
    }
  }

  /** Replace the default answer of one operation for this test. */
  handle(operation: string, handler: OperationHandler): void {
    this.handlers.set(operation, handler);
  }

  /** Answer an operation with a GraphQL error (and no data). */
  fail(operation: string, message = `${operation} failed (e2e mock)`): void {
    this.handle(operation, () => ({ data: null, errors: [{ message }] }));
  }

  /** Back to the default answer after {@link handle} or {@link fail}. */
  restore(operation: string): void {
    this.handlers.delete(operation);
  }

  /** Variables of every request for the given operation, in order. */
  callsTo(operation: string): Variables[] {
    return this.calls
      .filter((call) => call.operation === operation)
      .map((call) => call.variables);
  }

  /**
   * Simulate the API going away (requests are refused, the subscription
   * socket drops) and coming back (the reconnected socket is acknowledged).
   */
  setOffline(offline: boolean): void {
    this.offline = offline;
    if (offline) {
      for (const socket of this.sockets) {
        void socket.close({ code: 1012, reason: 'Service Restart' });
      }
      this.sockets.clear();
      return;
    }
    for (const socket of this.pendingSockets) {
      this.acknowledge(socket);
    }
    this.pendingSockets.clear();
  }

  private settings() {
    return DEFAULT_SETTINGS.map((setting) =>
      setting.key in this.settingOverrides
        ? { ...setting, value: this.settingOverrides[setting.key] }
        : setting,
    );
  }

  /** Default answers, keyed by operation name; values become `data`. */
  private defaultData(
    operation: string,
    variables: Variables,
  ): Record<string, unknown> {
    switch (operation) {
      case 'GetSettings':
        return { settings: { items: this.settings() } };
      case 'GetSetting': {
        const key = String(variables['key'] ?? '');
        return {
          setting: this.settings().find((item) => item.key === key) ?? null,
        };
      }
      case 'UpdateSettings': {
        // Store the changes; like the API, answer with the saved entries only.
        const input = variables['input'] as {
          settings: { key: string; value: string }[];
        };
        for (const { key, value } of input.settings) {
          this.settingOverrides[key] = value;
        }
        const saved = new Set(input.settings.map(({ key }) => key));
        return {
          updateSettings: this.settings().filter(({ key }) => saved.has(key)),
        };
      }
      case 'GetAvailablePrinters':
        return {
          availablePrinters: {
            items: [
              {
                name: 'printer1',
                description: 'Mock printer',
                state: 'idle',
                isDefault: true,
              },
            ],
            count: 1,
          },
        };
      case 'GetAvailableCameras':
        return { availableCameras: { cameras: [DEMO_CAMERA] } };
      case 'GetCameraStatus':
        return { cameraStatus: DEMO_CAMERA };
      case 'GetAppMetadata':
        return {
          appMetadata: {
            version: '0.0.0-e2e',
            name: 'Fotobox',
            platform: 'web',
            environment: 'test',
          },
        };
      case 'GetAppVersion':
        return { appVersion: '0.0.0-e2e' };
      case 'DetectedShareBaseUrl':
        return { detectedShareBaseUrl: `${API_ORIGIN}/share` };
      case 'GetAvailableLayoutIds':
        return { availableLayoutIds: ['Einzelbild', 'Collage'] };
      case 'GetLayoutPreview':
        return { layoutPreview: TINY_JPEG_DATA_URL };
      case 'InitializeCamera':
        return { initializeCamera: OK };
      case 'StartLiveView':
        return { startLiveView: OK };
      case 'StopLiveView':
        return { stopLiveView: OK };
      case 'TakePicture': {
        this.pictureCount++;
        return {
          takePicture: {
            id: `photo-${this.pictureCount}`,
            path: `/api/photos/photo-${this.pictureCount}.jpg`,
            timestamp: new Date().toISOString(),
          },
        };
      }
      case 'PrintPhoto':
        return { printPhoto: OK };
      case 'CreateShareLink':
        return {
          createShareLink: {
            url: `${API_ORIGIN}/share/${String(variables['filename'])}`,
            token: 'e2e-token',
            expiresAt: '2030-01-01T12:00:00.000Z',
          },
        };
      case 'RequiredCollagePhotos':
        return { requiredCollagePhotos: 2 };
      case 'StartCollage':
        return { startCollage: OK };
      case 'AddPhotoToCollage':
        return { addPhotoToCollage: OK };
      case 'CollagePreview':
        return { collagePreview: TINY_JPEG_DATA_URL };
      case 'FinalizeCollage':
        return {
          finalizeCollage: {
            id: 'collage-1',
            path: '/api/photos/collage-1.jpg',
            timestamp: new Date().toISOString(),
          },
        };
      case 'ResetCollage':
        return { resetCollage: OK };
      case 'Photos':
        return { photos: [] };
      default:
        return {};
    }
  }

  private async answerGraphql(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (this.offline) {
      await route.abort('connectionrefused');
      return;
    }

    const body = route.request().postDataJSON() as GraphqlBody;
    if (isTypenameHealthCheck(body)) {
      await route.fulfill({ json: { data: { __typename: 'Query' } } });
      return;
    }

    const operation = resolveOperationName(body);
    const variables = body.variables ?? {};
    this.calls.push({ operation, variables });

    const handler = this.handlers.get(operation);
    const response: GraphqlResponse | 'abort' = handler
      ? await handler(variables)
      : { data: this.defaultData(operation, variables) };
    if (response === 'abort') {
      await route.abort('connectionrefused');
      return;
    }
    await route.fulfill({ json: response });
  }

  /**
   * Minimal graphql-ws server: acknowledges the connection and keeps
   * subscriptions open without pushing events (pictures arrive through the
   * `takePicture` mutation result).
   */
  private answerSocket(socket: WebSocketRoute): void {
    socket.onMessage((message) => {
      const { type } = JSON.parse(String(message)) as { type: string };
      if (type === 'connection_init') {
        if (this.offline) {
          this.pendingSockets.add(socket);
        } else {
          this.acknowledge(socket);
        }
      } else if (type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    });
    socket.onClose(() => {
      this.sockets.delete(socket);
      this.pendingSockets.delete(socket);
    });
  }

  private acknowledge(socket: WebSocketRoute): void {
    this.sockets.add(socket);
    socket.send(JSON.stringify({ type: 'connection_ack' }));
  }

  async install(): Promise<void> {
    // Nothing may reach a real API on the default port (registered first so
    // the specific routes below take precedence).
    await this.page.route(`${API_ORIGIN}/**`, (route) =>
      route.abort('connectionrefused'),
    );
    await this.page.route('**/api/photos/**', (route) =>
      route.fulfill({
        contentType: 'image/jpeg',
        body: Buffer.from(TINY_JPEG, 'base64'),
      }),
    );
    await this.page.route('**/graphql', (route) => this.answerGraphql(route));
    await this.page.routeWebSocket('**/graphql', (socket) =>
      this.answerSocket(socket),
    );
  }
}

export async function mockFotoboxUiGraphql(
  page: Page,
): Promise<FotoboxUiGraphqlMock> {
  const mock = new FotoboxUiGraphqlMock(page);
  await mock.install();
  return mock;
}
