import type { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PubSub } from 'graphql-subscriptions';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApi, testDirs, type TestApi } from './support/test-app';

interface Picture {
  id: string;
  path: string;
  timestamp: string;
}

const TAKE_PICTURE = /* GraphQL */ `
  mutation {
    takePicture {
      id
      path
      timestamp
    }
  }
`;

const UPDATE_SETTINGS = /* GraphQL */ `
  mutation ($input: SettingsInput!) {
    updateSettings(input: $input) {
      key
    }
  }
`;

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

async function initDemoCamera(api: TestApi): Promise<void> {
  const { initializeCamera } = await api.gqlOk<{
    initializeCamera: { success: boolean; message: string };
  }>(/* GraphQL */ `
    mutation {
      initializeCamera(driver: "demo") {
        success
        message
      }
    }
  `);
  expect(initializeCamera).toEqual({
    success: true,
    message: 'Camera initialized with driver: demo',
  });
}

async function takePicture(api: TestApi): Promise<Picture> {
  const { takePicture } = await api.gqlOk<{ takePicture: Picture }>(
    TAKE_PICTURE,
  );
  return takePicture;
}

async function setPhotoDirectory(api: TestApi, dir: string): Promise<void> {
  await api.gqlOk(UPDATE_SETTINGS, {
    input: {
      settings: [{ key: 'photoDirectory', value: JSON.stringify(dir) }],
    },
  });
}

/** Run a complete collage on `templateId` and return the finalized result. */
async function makeCollage(
  api: TestApi,
  templateId: string,
  photos: string[],
): Promise<Picture> {
  const { startCollage } = await api.gqlOk<{
    startCollage: { success: boolean; message: string };
  }>(
    /* GraphQL */ `
      mutation ($input: CreateCollageInput!) {
        startCollage(input: $input) {
          success
          message
        }
      }
    `,
    { input: { templateId } },
  );
  expect(startCollage.success, startCollage.message).toBe(true);

  for (const photoPath of photos) {
    const { addPhotoToCollage } = await api.gqlOk<{
      addPhotoToCollage: { success: boolean; message: string };
    }>(
      /* GraphQL */ `
        mutation ($input: AddPhotoInput!) {
          addPhotoToCollage(input: $input) {
            success
            message
          }
        }
      `,
      { input: { photoPath } },
    );
    expect(addPhotoToCollage.success, addPhotoToCollage.message).toBe(true);
  }

  const { finalizeCollage } = await api.gqlOk<{ finalizeCollage: Picture }>(
    /* GraphQL */ `
      mutation {
        finalizeCollage {
          id
          path
          timestamp
        }
      }
    `,
  );
  return finalizeCollage;
}

const fileName = (picture: Picture) => path.basename(picture.path);

describe('photos and collages (demo camera)', () => {
  let api: TestApi;

  beforeEach(async () => {
    // Every test starts on the default photo folder.
    api = await startApi();
    await setPhotoDirectory(api, '');
    await api.close();
    api = await startApi();
    await initDemoCamera(api);
  });

  afterEach(async () => {
    await api.close();
  });

  it('takes a photo, stores it in the photo dir and serves it via /api/photos', async () => {
    const subscription = api.wsClient().iterate<{ pictureTaken: Picture }>({
      query: 'subscription { pictureTaken { id path } }',
    });
    // Subscribe before taking the picture; the first next() opens the socket.
    const firstEvent = subscription.next();
    await waitForSubscribers(api);

    const picture = await takePicture(api);

    expect(picture.id).toMatch(/^photo-\d+-[0-9a-f]{6}$/);
    expect(picture.path).toBe(`/api/photos/${picture.id}.jpg`);
    const filePath = path.join(testDirs.photos, `${picture.id}.jpg`);
    const stored = fs.readFileSync(filePath);
    expect([...stored.subarray(0, 3)]).toEqual(JPEG_MAGIC);

    const response = await fetch(`${api.baseUrl}${picture.path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await response.arrayBuffer()).equals(stored)).toBe(true);

    const event = await firstEvent;
    expect(event.value?.data?.pictureTaken).toEqual({
      id: picture.id,
      path: picture.path,
    });
    await subscription.return?.();

    const { photos, photoExists } = await api.gqlOk<{
      photos: { id: string }[];
      photoExists: boolean;
    }>(
      /* GraphQL */ `
        query ($id: String!) {
          photos {
            id
          }
          photoExists(photoId: $id)
        }
      `,
      { id: picture.id },
    );
    expect(photos.map((photo) => photo.id)).toContain(picture.id);
    expect(photoExists).toBe(true);
  });

  it('answers 404 for missing photos and paths outside the photo dir', async () => {
    fs.writeFileSync(path.join(testDirs.root, 'secret.jpg'), 'outside');

    for (const photoPath of [
      '/api/photos/photo-does-not-exist.jpg',
      '/api/photos/..%2Fsecret.jpg',
    ]) {
      const response = await fetch(`${api.baseUrl}${photoPath}`);
      expect(response.status, photoPath).toBe(404);
      await response.arrayBuffer();
    }
  });

  it('creates a collage from demo photos with the shipped 2x2 template', async () => {
    const { collageTemplates, requiredCollagePhotos } = await api.gqlOk<{
      collageTemplates: { id: string; photoCount: number }[];
      requiredCollagePhotos: number;
    }>(/* GraphQL */ `
      query {
        collageTemplates {
          id
          photoCount
        }
        requiredCollagePhotos(templateId: "2x2")
      }
    `);
    expect(collageTemplates).toContainEqual({
      id: '2x2',
      photoCount: requiredCollagePhotos,
    });
    expect(requiredCollagePhotos).toBeGreaterThan(1);

    const photos: string[] = [];
    for (let i = 0; i < requiredCollagePhotos; i++) {
      photos.push(fileName(await takePicture(api)));
    }
    const collage = await makeCollage(api, '2x2', photos);

    expect(collage.path).toBe(`/api/photos/${collage.id}.jpg`);
    const output = path.join(testDirs.photos, `${collage.id}.jpg`);
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({
      format: 'jpeg',
      width: 1796,
      height: 1204,
    });
    const response = await fetch(`${api.baseUrl}${collage.path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    await response.arrayBuffer();
  });

  it('builds the collage from a photo folder chosen in the settings (after restart)', async () => {
    // Regression: collages failed with "Input file is missing" when the
    // operator picked another photo folder than the startup default.
    const customDir = path.join(testDirs.root, 'custom-photos-restart');
    await setPhotoDirectory(api, customDir);
    await api.close();
    api = await startApi();
    await initDemoCamera(api);

    const picture = await takePicture(api);
    expect(fs.existsSync(path.join(customDir, `${picture.id}.jpg`))).toBe(true);
    expect(fs.existsSync(path.join(testDirs.photos, `${picture.id}.jpg`))).toBe(
      false,
    );

    const collage = await makeCollage(api, '2x2', [fileName(picture)]);
    expect(fs.existsSync(path.join(customDir, `${collage.id}.jpg`))).toBe(true);
    const response = await fetch(`${api.baseUrl}${collage.path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    await response.arrayBuffer();
  });

  it('applies a changed photo folder without a restart', async () => {
    const customDir = path.join(testDirs.root, 'custom-photos-live');
    await setPhotoDirectory(api, customDir);

    const { getPhotoDirectory } = await api.gqlOk<{
      getPhotoDirectory: string;
    }>('query { getPhotoDirectory }');
    expect(getPhotoDirectory).toBe(customDir);

    const picture = await takePicture(api);
    expect(fs.existsSync(path.join(customDir, `${picture.id}.jpg`))).toBe(true);
    const collage = await makeCollage(api, '2x2', [fileName(picture)]);
    expect(fs.existsSync(path.join(customDir, `${collage.id}.jpg`))).toBe(true);

    // Clearing the setting returns to the default folder.
    await setPhotoDirectory(api, '');
    const after = await api.gqlOk<{ getPhotoDirectory: string }>(
      'query { getPhotoDirectory }',
    );
    expect(after.getPhotoDirectory).toBe(testDirs.photos);
  });

  it('reports a missing collage photo as a GraphQL error and keeps serving', async () => {
    await api.gqlOk(/* GraphQL */ `
      mutation {
        startCollage(input: { templateId: "2x2" }) {
          success
        }
        addPhotoToCollage(input: { photoPath: "photo-missing.jpg" }) {
          success
        }
      }
    `);

    const result = await api.gql(/* GraphQL */ `
      mutation {
        finalizeCollage {
          id
        }
      }
    `);

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toMatch(/missing|photo-missing\.jpg/i);
    await api.gqlOk('mutation { resetCollage { success } }');
  });
});

/**
 * graphql-ws subscribes asynchronously; poll until the server has registered
 * the subscription so the picture event cannot be missed.
 */
async function waitForSubscribers(api: TestApi): Promise<void> {
  const events = (api.app.get(PubSub) as unknown as { ee: EventEmitter }).ee;
  for (let i = 0; i < 100; i++) {
    if (events.listenerCount('pictureTaken') > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('pictureTaken subscription was not registered');
}
