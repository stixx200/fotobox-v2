import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { map, Observable } from 'rxjs';
import { CollageEditorProject } from '@fotobox/collage-editor/browser';
import {
  CollageEditorLegacyTemplatesDocument,
  CollageEditorProjectDocument,
  CollageEditorProjectsDocument,
  CollageEditorProjectsQuery,
  DeleteCollageEditorProjectDocument,
  DuplicateCollageEditorProjectDocument,
  LayoutPreviewDocument,
  SaveCollageEditorProjectDocument,
  ValidateCollageTemplateDocument,
} from '@fotobox/graphql-operations';

export type CollageEditorProjectSummary =
  CollageEditorProjectsQuery['collageEditorProjects'][number];

export interface CollageEditorValidation {
  valid: boolean;
  previewBase64?: string;
  message?: string;
}

const TEMPLATE_ALREADY_EXISTS_CODE = 'MAIN.COLLAGE-EDITOR.ALREADY_EXISTS';

export function isCollageTemplateAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.some(
      (entry) =>
        entry.extensions?.['code'] === TEMPLATE_ALREADY_EXISTS_CODE ||
        /already exists/i.test(entry.message ?? ''),
    );
  }

  const graphQLErrors = (
    error as { graphQLErrors?: { extensions?: { code?: string }; message?: string }[] }
  ).graphQLErrors;
  if (
    graphQLErrors?.some(
      (entry) =>
        entry.extensions?.code === TEMPLATE_ALREADY_EXISTS_CODE ||
        /already exists/i.test(entry.message ?? ''),
    )
  ) {
    return true;
  }

  const message = (error as { message?: string }).message;
  return /already exists/i.test(message ?? '');
}

@Injectable({ providedIn: 'root' })
export class CollageEditorApiService {
  private apollo = inject(Apollo);

  listProjects(
    collageDirectory?: string,
  ): Observable<CollageEditorProjectSummary[]> {
    return this.apollo
      .query<CollageEditorProjectsQuery>({
        query: CollageEditorProjectsDocument,
        variables: { collageDirectory: collageDirectory || null },
      })
      .pipe(map((r) => r.data?.collageEditorProjects ?? []));
  }

  listLegacyTemplates(collageDirectory?: string): Observable<string[]> {
    return this.apollo
      .query<{ collageEditorLegacyTemplates: string[] }>({
        query: CollageEditorLegacyTemplatesDocument,
        variables: { collageDirectory: collageDirectory || null },
      })
      .pipe(map((r) => r.data?.collageEditorLegacyTemplates ?? []));
  }

  loadProject(
    templateId: string,
    collageDirectory?: string,
  ): Observable<CollageEditorProject> {
    return this.apollo
      .query<{
        collageEditorProject: {
          version: number;
          id: string;
          name?: string;
          width: number;
          height: number;
          borderJson?: string;
          fabricJson: string;
          layerMetaJson: string;
        };
      }>({
        query: CollageEditorProjectDocument,
        variables: { templateId, collageDirectory: collageDirectory || null },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((r) => {
          const p = r.data?.collageEditorProject;
          if (!p) {
            throw new Error('Project not found');
          }
          return {
            version: p.version as CollageEditorProject['version'],
            id: p.id,
            name: p.name,
            width: p.width,
            height: p.height,
            border: p.borderJson ? JSON.parse(p.borderJson) : undefined,
            fabricJson: JSON.parse(p.fabricJson),
            layerMeta: JSON.parse(p.layerMetaJson ?? '[]'),
          };
        }),
      );
  }

  saveProject(input: {
    project: CollageEditorProject;
    backgroundBase64: string;
    assets?: { filename: string; base64: string }[];
    collageDirectory?: string;
    overwrite?: boolean;
  }): Observable<{ templateId: string; path: string }> {
    return this.apollo
      .mutate<{ saveCollageEditorProject: { templateId: string; path: string } }>(
        {
          mutation: SaveCollageEditorProjectDocument,
          variables: {
            input: {
              projectJson: JSON.stringify(input.project),
              backgroundBase64: input.backgroundBase64,
              assets: input.assets,
              collageDirectory: input.collageDirectory || null,
              overwrite: input.overwrite ?? false,
            },
          },
        },
      )
      .pipe(
        map((r) => {
          if (r.error) {
            throw r.error;
          }
          const result = r.data?.saveCollageEditorProject;
          if (!result) {
            throw new Error('Save failed');
          }
          return result;
        }),
      );
  }

  validateTemplate(
    templateId: string,
    collageDirectory?: string,
  ): Observable<CollageEditorValidation> {
    return this.apollo
      .query<{ validateCollageTemplate: CollageEditorValidation }>({
        query: ValidateCollageTemplateDocument,
        variables: { templateId, collageDirectory: collageDirectory || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data?.validateCollageTemplate ?? { valid: false }));
  }

  getLayoutPreview(
    layoutId: string,
    collageDirectory?: string,
  ): Observable<string> {
    return this.apollo
      .query<{ layoutPreview: string }>({
        query: LayoutPreviewDocument,
        variables: { layoutId, collageDirectory: collageDirectory || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data?.layoutPreview ?? ''));
  }

  deleteProject(
    templateId: string,
    collageDirectory?: string,
  ): Observable<{ templateId: string }> {
    return this.apollo
      .mutate<{ deleteCollageEditorProject: { templateId: string } }>({
        mutation: DeleteCollageEditorProjectDocument,
        variables: { templateId, collageDirectory: collageDirectory || null },
      })
      .pipe(
        map((r) => {
          const result = r.data?.deleteCollageEditorProject;
          if (!result) throw new Error('Delete failed');
          return result;
        }),
      );
  }

  duplicateProject(
    templateId: string,
    newTemplateId: string,
    collageDirectory?: string,
  ): Observable<{ templateId: string; name: string }> {
    return this.apollo
      .mutate<{
        duplicateCollageEditorProject: { templateId: string; name: string };
      }>({
        mutation: DuplicateCollageEditorProjectDocument,
        variables: {
          templateId,
          newTemplateId,
          collageDirectory: collageDirectory || null,
        },
      })
      .pipe(
        map((r) => {
          const result = r.data?.duplicateCollageEditorProject;
          if (!result) throw new Error('Duplicate failed');
          return result;
        }),
      );
  }
}
