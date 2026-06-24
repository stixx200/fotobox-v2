import type { Page, Route } from '@playwright/test';

type GraphqlBody = {
  operationName?: string;
  query?: string;
  variables?: Record<string, unknown>;
};

const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD/9k=';

const DEFAULT_SETTINGS = [
  { key: 'shutterTimeout', value: '5', description: 'Shutter timeout' },
  { key: 'usePrinter', value: 'true', description: 'Use printer' },
  { key: 'useShare', value: 'false', description: 'Use share' },
  { key: 'shareBaseUrl', value: '""', description: 'Share base URL' },
  { key: 'shareTokenExpiryHours', value: '24', description: 'Share token expiry' },
  { key: 'printerName', value: '"printer1"', description: 'Printer name' },
  { key: 'showPrintDialog', value: 'false', description: 'Show print dialog' },
  { key: 'photoDirectory', value: '"/tmp/photos"', description: 'Photo directory' },
  { key: 'collageDirectory', value: '""', description: 'Collage directory' },
  { key: 'layouts', value: '["Einzelbild"]', description: 'Active layouts' },
  { key: 'camera', value: '"demo"', description: 'Camera driver' },
  { key: 'galleryPassword', value: '""', description: 'Gallery PIN' },
  { key: 'showGalleryButton', value: 'false', description: 'Show gallery button' },
];

function resolveOperationName(body: GraphqlBody): string {
  if (body.operationName) {
    return body.operationName;
  }
  const match = body.query?.match(/(?:query|mutation)\s+(\w+)/);
  return match?.[1] ?? '';
}

function isTypenameHealthCheck(body: GraphqlBody): boolean {
  return body.query?.includes('__typename') ?? false;
}

export class FotoboxUiGraphqlMock {
  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    await this.page.route('**/graphql', async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON() as GraphqlBody;
      const operation = resolveOperationName(body);
      const variables = body.variables ?? {};

      if (isTypenameHealthCheck(body)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { __typename: 'Query' } }),
        });
        return;
      }

      switch (operation) {
        case 'GetSettings':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { settings: { items: DEFAULT_SETTINGS } },
            }),
          });
          return;
        case 'GetSetting': {
          const key = String(variables['key'] ?? '');
          const setting =
            DEFAULT_SETTINGS.find((item) => item.key === key) ?? null;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { setting } }),
          });
          return;
        }
        case 'GetAvailablePrinters':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
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
              },
            }),
          });
          return;
        case 'GetAvailableCameras':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                availableCameras: {
                  cameras: [
                    {
                      driver: 'demo',
                      status: 'ready',
                      available: true,
                      location: 'local',
                      capabilities: { liveView: true },
                    },
                  ],
                },
              },
            }),
          });
          return;
        case 'GetCameraStatus':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                cameraStatus: {
                  driver: 'demo',
                  status: 'ready',
                  available: true,
                  location: 'local',
                  capabilities: { liveView: true },
                },
              },
            }),
          });
          return;
        case 'GetAppMetadata':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                appMetadata: {
                  version: '0.0.0-e2e',
                  name: 'Fotobox',
                  platform: 'web',
                  environment: 'test',
                },
              },
            }),
          });
          return;
        case 'GetAppVersion':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { appVersion: '0.0.0-e2e' } }),
          });
          return;
        case 'DetectedShareBaseUrl':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { detectedShareBaseUrl: 'http://localhost:3000/share' },
            }),
          });
          return;
        case 'GetAvailableLayoutIds':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { availableLayoutIds: ['Einzelbild'] },
            }),
          });
          return;
        case 'GetLayoutPreview':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                layoutPreview: `data:image/jpeg;base64,${TINY_JPEG}`,
              },
            }),
          });
          return;
        default:
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: {} }),
          });
      }
    });
  }
}

export async function mockFotoboxUiGraphql(
  page: Page,
): Promise<FotoboxUiGraphqlMock> {
  const mock = new FotoboxUiGraphqlMock(page);
  await mock.install();
  return mock;
}
