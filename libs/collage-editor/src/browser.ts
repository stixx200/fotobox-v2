export * from './lib/constants';
export * from './lib/collage-editor-project.interface';
export { validateCollageEditorProject, projectHasValidationErrors } from './lib/validate-project';
export type { ProjectValidationIssue, ValidationSeverity } from './lib/validate-project';
export { prepareProjectForSave } from './lib/prepare-save';

export type {
  Border,
  Color,
  PhotoSpace,
  Space,
  TemplateInterface,
} from '@fotobox/collage-maker';
