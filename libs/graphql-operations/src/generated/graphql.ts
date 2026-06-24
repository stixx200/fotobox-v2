/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type CollageEditorAssetInput = {
  base64: string;
  filename: string;
};

export type SaveCollageEditorProjectInput = {
  assets?: Array<CollageEditorAssetInput> | null | undefined;
  backgroundBase64: string;
  collageDirectory?: string | null | undefined;
  overwrite?: boolean | null | undefined;
  projectJson: string;
};

export type CollageEditorProjectsQueryVariables = Exact<{
  collageDirectory?: string | null | undefined;
}>;


export type CollageEditorProjectsQuery = { collageEditorProjects: Array<{ id: string, name: string | null, width: number, height: number, updatedAt: string | null, thumbnailBase64: string | null }> };

export type CollageEditorLegacyTemplatesQueryVariables = Exact<{
  collageDirectory?: string | null | undefined;
}>;


export type CollageEditorLegacyTemplatesQuery = { collageEditorLegacyTemplates: Array<string> };

export type CollageEditorProjectQueryVariables = Exact<{
  templateId: string;
  collageDirectory?: string | null | undefined;
}>;


export type CollageEditorProjectQuery = { collageEditorProject: { version: number, id: string, name: string | null, width: number, height: number, borderJson: string | null, fabricJson: string, layerMetaJson: string } };

export type SaveCollageEditorProjectMutationVariables = Exact<{
  input: SaveCollageEditorProjectInput;
}>;


export type SaveCollageEditorProjectMutation = { saveCollageEditorProject: { templateId: string, path: string } };

export type DeleteCollageEditorProjectMutationVariables = Exact<{
  templateId: string;
  collageDirectory?: string | null | undefined;
}>;


export type DeleteCollageEditorProjectMutation = { deleteCollageEditorProject: { templateId: string } };

export type DuplicateCollageEditorProjectMutationVariables = Exact<{
  templateId: string;
  newTemplateId: string;
  collageDirectory?: string | null | undefined;
}>;


export type DuplicateCollageEditorProjectMutation = { duplicateCollageEditorProject: { templateId: string, name: string } };

export type ValidateCollageTemplateQueryVariables = Exact<{
  templateId: string;
  collageDirectory?: string | null | undefined;
}>;


export type ValidateCollageTemplateQuery = { validateCollageTemplate: { valid: boolean, previewBase64: string | null, message: string | null } };

export type LayoutPreviewQueryVariables = Exact<{
  layoutId: string;
  collageDirectory?: string | null | undefined;
}>;


export type LayoutPreviewQuery = { layoutPreview: string };


export const CollageEditorProjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CollageEditorProjects"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"collageEditorProjects"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailBase64"}}]}}]}}]} as unknown as DocumentNode<CollageEditorProjectsQuery, CollageEditorProjectsQueryVariables>;
export const CollageEditorLegacyTemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CollageEditorLegacyTemplates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"collageEditorLegacyTemplates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}]}]}}]} as unknown as DocumentNode<CollageEditorLegacyTemplatesQuery, CollageEditorLegacyTemplatesQueryVariables>;
export const CollageEditorProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CollageEditorProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"collageEditorProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"templateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}}},{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"borderJson"}},{"kind":"Field","name":{"kind":"Name","value":"fabricJson"}},{"kind":"Field","name":{"kind":"Name","value":"layerMetaJson"}}]}}]}}]} as unknown as DocumentNode<CollageEditorProjectQuery, CollageEditorProjectQueryVariables>;
export const SaveCollageEditorProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveCollageEditorProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveCollageEditorProjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveCollageEditorProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templateId"}},{"kind":"Field","name":{"kind":"Name","value":"path"}}]}}]}}]} as unknown as DocumentNode<SaveCollageEditorProjectMutation, SaveCollageEditorProjectMutationVariables>;
export const DeleteCollageEditorProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteCollageEditorProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteCollageEditorProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"templateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}}},{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templateId"}}]}}]}}]} as unknown as DocumentNode<DeleteCollageEditorProjectMutation, DeleteCollageEditorProjectMutationVariables>;
export const DuplicateCollageEditorProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DuplicateCollageEditorProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newTemplateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"duplicateCollageEditorProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"templateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}}},{"kind":"Argument","name":{"kind":"Name","value":"newTemplateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newTemplateId"}}},{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templateId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<DuplicateCollageEditorProjectMutation, DuplicateCollageEditorProjectMutationVariables>;
export const ValidateCollageTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ValidateCollageTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"validateCollageTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"templateId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"templateId"}}},{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"previewBase64"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<ValidateCollageTemplateQuery, ValidateCollageTemplateQueryVariables>;
export const LayoutPreviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LayoutPreview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"layoutId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"layoutPreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"layoutId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"layoutId"}}},{"kind":"Argument","name":{"kind":"Name","value":"collageDirectory"},"value":{"kind":"Variable","name":{"kind":"Name","value":"collageDirectory"}}}]}]}}]} as unknown as DocumentNode<LayoutPreviewQuery, LayoutPreviewQueryVariables>;