import type { Page, Route } from '@playwright/test';

type GraphqlBody = {
  operationName?: string;
  query?: string;
  variables?: Record<string, unknown>;
};

export type MockProjectSummary = {
  id: string;
  name?: string;
  width: number;
  height: number;
  updatedAt?: string;
  thumbnailBase64?: string;
};

const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD/9k=';

function resolveOperationName(body: GraphqlBody): string {
  if (body.operationName) {
    return body.operationName;
  }
  const match = body.query?.match(/(?:query|mutation)\s+(\w+)/);
  return match?.[1] ?? '';
}

function emptyFabricJson(): Record<string, unknown> {
  return {
    version: '6.0.0',
    objects: [],
  };
}

function parseSaveProjectInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof input['projectJson'] === 'string') {
    return JSON.parse(input['projectJson']) as Record<string, unknown>;
  }
  if (input['project'] && typeof input['project'] === 'object') {
    return input['project'] as Record<string, unknown>;
  }
  return {};
}

export class CollageEditorGraphqlMock {
  readonly projects: MockProjectSummary[] = [];
  readonly legacyTemplates: string[] = [];
  readonly savedProjects = new Map<string, Record<string, unknown>>();

  constructor(private readonly page: Page) {
    this.projects.push({
      id: 'existing-template',
      name: 'Existing template',
      width: 1796,
      height: 1200,
      updatedAt: '2026-01-01T12:00:00.000Z',
    });
    this.savedProjects.set('existing-template', {
      version: 1,
      id: 'existing-template',
      name: 'Existing template',
      width: 1796,
      height: 1200,
      fabricJson: JSON.stringify(emptyFabricJson()),
      layerMetaJson: JSON.stringify([]),
    });
  }

  async install(): Promise<void> {
    await this.page.route('**/graphql', async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON() as GraphqlBody;
      const operation = resolveOperationName(body);
      const variables = body.variables ?? {};

      switch (operation) {
        case 'CollageEditorProjects':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { collageEditorProjects: [...this.projects] },
            }),
          });
          return;
        case 'CollageEditorLegacyTemplates':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { collageEditorLegacyTemplates: [...this.legacyTemplates] },
            }),
          });
          return;
        case 'CollageEditorProject': {
          const templateId = String(variables['templateId'] ?? '');
          const project = this.savedProjects.get(templateId);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                collageEditorProject: project ?? null,
              },
            }),
          });
          return;
        }
        case 'SaveCollageEditorProject': {
          const input = (variables['input'] ?? {}) as Record<string, unknown>;
          const project = parseSaveProjectInput(input);
          const templateId = String(project['id'] ?? 'saved-template');
          const name = String(project['name'] ?? templateId);
          const width = Number(project['width'] ?? 1796);
          const height = Number(project['height'] ?? 1200);
          const overwrite = Boolean(input['overwrite']);

          if (!overwrite && this.savedProjects.has(templateId)) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                errors: [
                  {
                    message: `Template '${templateId}' already exists. Pass overwrite to replace it.`,
                    extensions: {
                      code: 'MAIN.COLLAGE-EDITOR.ALREADY_EXISTS',
                      info: { id: templateId },
                    },
                  },
                ],
                data: null,
              }),
            });
            return;
          }

          this.savedProjects.set(templateId, {
            version: project['version'] ?? 1,
            id: templateId,
            name,
            width,
            height,
            fabricJson:
              typeof project['fabricJson'] === 'string'
                ? project['fabricJson']
                : JSON.stringify(project['fabricJson'] ?? emptyFabricJson()),
            layerMetaJson: JSON.stringify(project['layerMeta'] ?? []),
          });

          const existingIndex = this.projects.findIndex((p) => p.id === templateId);
          const summary: MockProjectSummary = {
            id: templateId,
            name,
            width,
            height,
            updatedAt: new Date().toISOString(),
          };
          if (existingIndex >= 0) {
            this.projects[existingIndex] = summary;
          } else {
            this.projects.unshift(summary);
          }

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                saveCollageEditorProject: {
                  templateId,
                  path: `/tmp/collage-templates/${templateId}`,
                },
              },
            }),
          });
          return;
        }
        case 'DeleteCollageEditorProject': {
          const templateId = String(variables['templateId'] ?? '');
          this.projects.splice(
            this.projects.findIndex((p) => p.id === templateId),
            1,
          );
          this.savedProjects.delete(templateId);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                deleteCollageEditorProject: { templateId },
              },
            }),
          });
          return;
        }
        case 'DuplicateCollageEditorProject': {
          const templateId = String(variables['templateId'] ?? '');
          const newTemplateId = String(variables['newTemplateId'] ?? `${templateId}-copy`);
          const source = this.savedProjects.get(templateId);
          if (source) {
            this.savedProjects.set(newTemplateId, {
              ...source,
              id: newTemplateId,
              name: `${String(source['name'] ?? templateId)} (copy)`,
            });
          }
          this.projects.unshift({
            id: newTemplateId,
            name: source ? `${String(source['name'] ?? templateId)} (copy)` : newTemplateId,
            width: Number(source?.['width'] ?? 1796),
            height: Number(source?.['height'] ?? 1200),
            updatedAt: new Date().toISOString(),
          });
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                duplicateCollageEditorProject: {
                  templateId: newTemplateId,
                  name: `${templateId} copy`,
                },
              },
            }),
          });
          return;
        }
        case 'LayoutPreview':
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
        case 'ValidateCollageTemplate':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                validateCollageTemplate: {
                  valid: true,
                  previewBase64: TINY_JPEG,
                },
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

export async function mockCollageEditorGraphql(page: Page): Promise<CollageEditorGraphqlMock> {
  const mock = new CollageEditorGraphqlMock(page);
  await mock.install();
  return mock;
}
