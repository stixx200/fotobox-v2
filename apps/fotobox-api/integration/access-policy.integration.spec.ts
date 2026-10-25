import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'graphql-ws';
import {
  FAKE_REMOTE_ADDRESS_HEADER,
  startApi,
  testDirs,
  type TestApi,
} from './support/test-app';

const LAN_CLIENT = { [FAKE_REMOTE_ADDRESS_HEADER]: '192.168.178.50' };
const LAN_TOKEN = 'it-lan-secret';
const TYPENAME = '{ __typename }';

let photoFile: string;

beforeAll(async () => {
  photoFile = 'photo-access-policy.jpg';
  const jpeg = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#808080' },
  })
    .jpeg()
    .toBuffer();
  fs.writeFileSync(path.join(testDirs.photos, photoFile), jpeg);
});

async function get(
  api: TestApi,
  urlPath: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const response = await fetch(`${api.baseUrl}${urlPath}`, { headers });
  await response.clone().arrayBuffer();
  return response;
}

/** Run one operation over graphql-ws; resolves with the close code on failure. */
function wsQuery(client: Client): Promise<{ ok: boolean; code?: number }> {
  return new Promise((resolve) => {
    client.subscribe(
      { query: TYPENAME },
      {
        next: () => undefined,
        error: (error: unknown) =>
          resolve({ ok: false, code: (error as { code?: number }).code }),
        complete: () => resolve({ ok: true }),
      },
    );
  });
}

describe('access policy (default: LAN restricted to share links)', () => {
  let api: TestApi | undefined;

  afterEach(async () => {
    await api?.close();
    api = undefined;
  });

  it('allows loopback clients without an Origin header', async () => {
    api = await startApi();
    const result = await api.gql(TYPENAME);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ __typename: 'Query' });
    expect((await get(api, `/api/photos/${photoFile}`)).status).toBe(200);
  });

  it('allows trusted browser origins from loopback and answers CORS for them', async () => {
    api = await startApi({ FOTOBOX_TRUSTED_ORIGINS: 'https://kiosk.example/' });
    for (const origin of [
      'http://localhost:5101',
      'http://127.0.0.1:5102',
      'tauri://localhost',
      'http://tauri.localhost',
      'null',
      'https://kiosk.example',
    ]) {
      const result = await api.gql(TYPENAME, undefined, { origin });
      expect(result.status, origin).toBe(200);
    }

    const preflight = await fetch(`${api.baseUrl}/graphql`, {
      method: 'OPTIONS',
      headers: {
        origin: 'tauri://localhost',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe(
      'tauri://localhost',
    );
  });

  it('rejects untrusted browser origins even from loopback', async () => {
    api = await startApi();
    const result = await api.gql(TYPENAME, undefined, {
      origin: 'https://evil.example',
    });
    expect(result.status).toBe(403);

    const preflight = await fetch(`${api.baseUrl}/graphql`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();

    const ws = await wsQuery(
      api.wsClient({ headers: { origin: 'https://evil.example' } }),
    );
    expect(ws).toEqual({ ok: false, code: 4403 });
  });

  it('rejects LAN clients on GraphQL, photos and WebSocket — even with a token', async () => {
    api = await startApi({ FOTOBOX_LAN_API_TOKEN: LAN_TOKEN });
    expect((await api.gql(TYPENAME, undefined, LAN_CLIENT)).status).toBe(403);
    expect(
      (
        await api.gql(TYPENAME, undefined, {
          ...LAN_CLIENT,
          'x-fotobox-token': LAN_TOKEN,
        })
      ).status,
    ).toBe(403);
    const photo = await get(api, `/api/photos/${photoFile}`, LAN_CLIENT);
    expect(photo.status).toBe(403);
    expect(await photo.json()).toEqual({
      statusCode: 403,
      message: 'Forbidden',
    });

    const ws = await wsQuery(
      api.wsClient({
        headers: LAN_CLIENT,
        connectionParams: { token: LAN_TOKEN },
      }),
    );
    expect(ws).toEqual({ ok: false, code: 4403 });

    // Loopback WebSocket clients keep working.
    expect(await wsQuery(api.wsClient())).toEqual({ ok: true });
  });

  it('serves guest share links to LAN clients without a token', async () => {
    api = await startApi();
    await api.gqlOk(/* GraphQL */ `
      mutation {
        updateSettings(
          input: {
            settings: [
              { key: "useShare", value: "true" }
              { key: "shareBaseUrl", value: "\\"http://fotobox.local:5100\\"" }
            ]
          }
        ) {
          key
        }
      }
    `);
    const { createShareLink } = await api.gqlOk<{
      createShareLink: { url: string; token: string; expiresAt: string };
    }>(
      /* GraphQL */ `
        mutation ($filename: String!) {
          createShareLink(filename: $filename) {
            url
            token
            expiresAt
          }
        }
      `,
      { filename: photoFile },
    );
    expect(createShareLink.url).toBe(
      `http://fotobox.local:5100/api/share/${createShareLink.token}`,
    );
    expect(Date.parse(createShareLink.expiresAt)).toBeGreaterThan(Date.now());

    const sharePath = `/api/share/${createShareLink.token}`;
    const page = await get(api, sharePath, LAN_CLIENT);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain(`${sharePath}?download=1`);

    const inline = await get(api, `${sharePath}?inline=1`, LAN_CLIENT);
    expect(inline.status).toBe(200);
    expect(inline.headers.get('content-type')).toBe('image/jpeg');

    const download = await get(api, `${sharePath}?download=1`, LAN_CLIENT);
    expect(download.headers.get('content-disposition')).toBe(
      `attachment; filename="${photoFile}"`,
    );

    // Only GET/HEAD on a concrete token is public.
    expect((await get(api, '/api/share/', LAN_CLIENT)).status).toBe(403);
    const post = await fetch(`${api.baseUrl}${sharePath}`, {
      method: 'POST',
      headers: LAN_CLIENT,
    });
    expect(post.status).toBe(403);
    await post.arrayBuffer();

    expect((await get(api, '/api/share/not-a-token', LAN_CLIENT)).status).toBe(
      410,
    );
  });

  it('refuses share links while sharing is disabled', async () => {
    api = await startApi();
    await api.gqlOk(
      'mutation { updateSettings(input: { settings: [{ key: "useShare", value: "false" }] }) { key } }',
    );
    const result = await api.gql(
      'mutation ($f: String!) { createShareLink(filename: $f) { url } }',
      { f: photoFile },
    );
    expect(result.errors?.[0]?.message).toBe(
      'Photo sharing is disabled in settings',
    );
  });
});

describe('access policy (tablet mode)', () => {
  let api: TestApi | undefined;

  afterEach(async () => {
    await api?.close();
    api = undefined;
  });

  it('gives LAN clients with the token full access via header, query and WebSocket', async () => {
    api = await startApi({
      FOTOBOX_ALLOW_LAN_API: '1',
      FOTOBOX_LAN_API_TOKEN: LAN_TOKEN,
    });

    const viaHeader = await api.gql(TYPENAME, undefined, {
      ...LAN_CLIENT,
      'x-fotobox-token': LAN_TOKEN,
      // Any origin may call the API in tablet mode, as long as it has the token.
      origin: 'http://192.168.178.50:8080',
    });
    expect(viaHeader.status).toBe(200);
    expect(viaHeader.data).toEqual({ __typename: 'Query' });

    const viaQuery = await get(
      api,
      `/api/photos/${photoFile}?token=${LAN_TOKEN}`,
      LAN_CLIENT,
    );
    expect(viaQuery.status).toBe(200);

    expect(
      await wsQuery(
        api.wsClient({
          headers: LAN_CLIENT,
          connectionParams: { token: LAN_TOKEN },
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('rejects LAN clients with a missing or wrong token', async () => {
    api = await startApi({
      FOTOBOX_ALLOW_LAN_API: 'true',
      FOTOBOX_LAN_API_TOKEN: LAN_TOKEN,
    });
    expect((await api.gql(TYPENAME, undefined, LAN_CLIENT)).status).toBe(403);
    expect(
      (
        await api.gql(TYPENAME, undefined, {
          ...LAN_CLIENT,
          'x-fotobox-token': `${LAN_TOKEN}-wrong`,
        })
      ).status,
    ).toBe(403);
    expect(
      await wsQuery(
        api.wsClient({ headers: LAN_CLIENT, connectionParams: { token: 'x' } }),
      ),
    ).toEqual({ ok: false, code: 4403 });
  });

  it('stays locked when tablet mode is requested without a token', async () => {
    api = await startApi({
      FOTOBOX_ALLOW_LAN_API: '1',
      FOTOBOX_LAN_API_TOKEN: '  ',
    });
    const result = await api.gql(TYPENAME, undefined, {
      ...LAN_CLIENT,
      'x-fotobox-token': '  ',
    });
    expect(result.status).toBe(403);
    // Loopback (kiosk) access is unaffected.
    expect((await api.gql(TYPENAME)).status).toBe(200);
  });
});
