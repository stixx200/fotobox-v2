/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query CollageEditorProjects($collageDirectory: String) {\n  collageEditorProjects(collageDirectory: $collageDirectory) {\n    id\n    name\n    width\n    height\n    updatedAt\n    thumbnailBase64\n  }\n}\n\nquery CollageEditorLegacyTemplates($collageDirectory: String) {\n  collageEditorLegacyTemplates(collageDirectory: $collageDirectory)\n}\n\nquery CollageEditorProject($templateId: String!, $collageDirectory: String) {\n  collageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    version\n    id\n    name\n    width\n    height\n    borderJson\n    fabricJson\n    layerMetaJson\n  }\n}\n\nmutation SaveCollageEditorProject($input: SaveCollageEditorProjectInput!) {\n  saveCollageEditorProject(input: $input) {\n    templateId\n    path\n  }\n}\n\nmutation DeleteCollageEditorProject($templateId: String!, $collageDirectory: String) {\n  deleteCollageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n  }\n}\n\nmutation DuplicateCollageEditorProject($templateId: String!, $newTemplateId: String!, $collageDirectory: String) {\n  duplicateCollageEditorProject(\n    templateId: $templateId\n    newTemplateId: $newTemplateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n    name\n  }\n}\n\nquery ValidateCollageTemplate($templateId: String!, $collageDirectory: String) {\n  validateCollageTemplate(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    valid\n    previewBase64\n    message\n  }\n}\n\nquery LayoutPreview($layoutId: String!, $collageDirectory: String) {\n  layoutPreview(layoutId: $layoutId, collageDirectory: $collageDirectory)\n}": typeof types.CollageEditorProjectsDocument,
};
const documents: Documents = {
    "query CollageEditorProjects($collageDirectory: String) {\n  collageEditorProjects(collageDirectory: $collageDirectory) {\n    id\n    name\n    width\n    height\n    updatedAt\n    thumbnailBase64\n  }\n}\n\nquery CollageEditorLegacyTemplates($collageDirectory: String) {\n  collageEditorLegacyTemplates(collageDirectory: $collageDirectory)\n}\n\nquery CollageEditorProject($templateId: String!, $collageDirectory: String) {\n  collageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    version\n    id\n    name\n    width\n    height\n    borderJson\n    fabricJson\n    layerMetaJson\n  }\n}\n\nmutation SaveCollageEditorProject($input: SaveCollageEditorProjectInput!) {\n  saveCollageEditorProject(input: $input) {\n    templateId\n    path\n  }\n}\n\nmutation DeleteCollageEditorProject($templateId: String!, $collageDirectory: String) {\n  deleteCollageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n  }\n}\n\nmutation DuplicateCollageEditorProject($templateId: String!, $newTemplateId: String!, $collageDirectory: String) {\n  duplicateCollageEditorProject(\n    templateId: $templateId\n    newTemplateId: $newTemplateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n    name\n  }\n}\n\nquery ValidateCollageTemplate($templateId: String!, $collageDirectory: String) {\n  validateCollageTemplate(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    valid\n    previewBase64\n    message\n  }\n}\n\nquery LayoutPreview($layoutId: String!, $collageDirectory: String) {\n  layoutPreview(layoutId: $layoutId, collageDirectory: $collageDirectory)\n}": types.CollageEditorProjectsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query CollageEditorProjects($collageDirectory: String) {\n  collageEditorProjects(collageDirectory: $collageDirectory) {\n    id\n    name\n    width\n    height\n    updatedAt\n    thumbnailBase64\n  }\n}\n\nquery CollageEditorLegacyTemplates($collageDirectory: String) {\n  collageEditorLegacyTemplates(collageDirectory: $collageDirectory)\n}\n\nquery CollageEditorProject($templateId: String!, $collageDirectory: String) {\n  collageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    version\n    id\n    name\n    width\n    height\n    borderJson\n    fabricJson\n    layerMetaJson\n  }\n}\n\nmutation SaveCollageEditorProject($input: SaveCollageEditorProjectInput!) {\n  saveCollageEditorProject(input: $input) {\n    templateId\n    path\n  }\n}\n\nmutation DeleteCollageEditorProject($templateId: String!, $collageDirectory: String) {\n  deleteCollageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n  }\n}\n\nmutation DuplicateCollageEditorProject($templateId: String!, $newTemplateId: String!, $collageDirectory: String) {\n  duplicateCollageEditorProject(\n    templateId: $templateId\n    newTemplateId: $newTemplateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n    name\n  }\n}\n\nquery ValidateCollageTemplate($templateId: String!, $collageDirectory: String) {\n  validateCollageTemplate(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    valid\n    previewBase64\n    message\n  }\n}\n\nquery LayoutPreview($layoutId: String!, $collageDirectory: String) {\n  layoutPreview(layoutId: $layoutId, collageDirectory: $collageDirectory)\n}"): (typeof documents)["query CollageEditorProjects($collageDirectory: String) {\n  collageEditorProjects(collageDirectory: $collageDirectory) {\n    id\n    name\n    width\n    height\n    updatedAt\n    thumbnailBase64\n  }\n}\n\nquery CollageEditorLegacyTemplates($collageDirectory: String) {\n  collageEditorLegacyTemplates(collageDirectory: $collageDirectory)\n}\n\nquery CollageEditorProject($templateId: String!, $collageDirectory: String) {\n  collageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    version\n    id\n    name\n    width\n    height\n    borderJson\n    fabricJson\n    layerMetaJson\n  }\n}\n\nmutation SaveCollageEditorProject($input: SaveCollageEditorProjectInput!) {\n  saveCollageEditorProject(input: $input) {\n    templateId\n    path\n  }\n}\n\nmutation DeleteCollageEditorProject($templateId: String!, $collageDirectory: String) {\n  deleteCollageEditorProject(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n  }\n}\n\nmutation DuplicateCollageEditorProject($templateId: String!, $newTemplateId: String!, $collageDirectory: String) {\n  duplicateCollageEditorProject(\n    templateId: $templateId\n    newTemplateId: $newTemplateId\n    collageDirectory: $collageDirectory\n  ) {\n    templateId\n    name\n  }\n}\n\nquery ValidateCollageTemplate($templateId: String!, $collageDirectory: String) {\n  validateCollageTemplate(\n    templateId: $templateId\n    collageDirectory: $collageDirectory\n  ) {\n    valid\n    previewBase64\n    message\n  }\n}\n\nquery LayoutPreview($layoutId: String!, $collageDirectory: String) {\n  layoutPreview(layoutId: $layoutId, collageDirectory: $collageDirectory)\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;