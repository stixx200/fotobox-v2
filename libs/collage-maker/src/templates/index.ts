import * as fs from 'fs-extra';
import path from 'node:path';

import template2x2 from './2x2';
import { TemplateInterface } from '../lib/template.interface';
import { FotoboxError } from '@fotobox/error';

const defaultTemplates = [template2x2];

export function getTemplates(
  templateDirectory?: string
): Record<string, TemplateInterface> {
  const templates: Record<string, TemplateInterface> = {};
  for (const template of defaultTemplates) {
    if (template && template.id) {
      templates[template.id] = template;
    } else {
      throw new FotoboxError(
        `Default template '${template.id}' does not have a valid 'id' property.`,
        { code: 'MAIN.COLLAGE-MAKER.INVALID_TEMPLATE' }
      );
    }
  }

  if (templateDirectory && fs.existsSync(templateDirectory)) {
    const templateFolders = fs
      .readdirSync(templateDirectory)
      .filter((template) =>
        fs.statSync(path.join(templateDirectory, template)).isDirectory()
      );
    for (const template of templateFolders) {
      const resolvedTemplate = require(/* webpackIgnore: true */ path.join(
        templateDirectory,
        template
      )) as TemplateInterface;
      if (resolvedTemplate && resolvedTemplate.id) {
        templates[resolvedTemplate.id] = resolvedTemplate;
      } else {
        throw new FotoboxError(
          `Template '${template}' in directory '${templateDirectory}' does not have a valid 'id' property.`,
          { code: 'MAIN.COLLAGE-MAKER.INVALID_TEMPLATE' }
        );
      }
    }
  }
  return templates;
}

export function resolveTemplate(
  templateId: string,
  templateDirectory?: string
): TemplateInterface {
  const templates = getTemplates(templateDirectory);
  if (templateId in templates) {
    return templates[templateId];
  }
  throw new FotoboxError(
    `Template '${templateId}' not found. Available are: '${Object.keys(
      templates
    ).join(', ')}'`,
    { code: 'MAIN.COLLAGE-MAKER.TEMPLATE_NOT_FOUND', info: { templateId } }
  );
}
