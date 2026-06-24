import * as fs from 'fs-extra';
import path from 'node:path';
import { createRequire } from 'node:module';

import { TemplateInterface } from '../lib/template.interface';
import { FotoboxError } from '@fotobox/error';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('CollageTemplates');

function resolveBackgroundPath(
  template: TemplateInterface,
  templatePath: string,
): void {
  if (
    template.background &&
    typeof template.background === 'string' &&
    !path.isAbsolute(template.background)
  ) {
    template.background = path.join(templatePath, template.background);
  }
}

/**
 * Resolve a real CommonJS `require` at runtime.
 *
 * When bundled by webpack (e.g. inside the API server) `createRequire` and
 * `import.meta.url` get stubbed out, breaking dynamic template loading. Webpack
 * exposes the untouched runtime require as `__non_webpack_require__`, so prefer
 * that and fall back to `createRequire` for non-bundled (ESM/test) execution.
 */
declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire: NodeRequire =
  typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__
    : createRequire(import.meta.url);

function loadTemplatesFromDirectory(
  templateDirectory: string,
  templates: Record<string, TemplateInterface>,
) {
  if (!fs.existsSync(templateDirectory)) {
    return;
  }
  const templateFolders = fs
    .readdirSync(templateDirectory)
    .filter((template) =>
      fs.statSync(path.join(templateDirectory, template)).isDirectory(),
    );
  for (const templateName of templateFolders) {
    const templatePath = path.join(templateDirectory, templateName);
    try {
      let resolvedTemplate: TemplateInterface | undefined;

      // Try loading as JSON
      const indexJsonPath = path.join(templatePath, 'index.json');
      if (fs.existsSync(indexJsonPath)) {
        try {
          const templateData = fs.readFileSync(indexJsonPath, 'utf8');
          resolvedTemplate = JSON.parse(templateData) as TemplateInterface;
          resolveBackgroundPath(resolvedTemplate, templatePath);
        } catch (jsonError) {
          logger.debug(
            `Failed to load '${templateName}' as JSON: ${
              jsonError instanceof Error ? jsonError.message : String(jsonError)
            }`,
          );
        }
      }

      // Try loading as CommonJS module
      if (!resolvedTemplate) {
        try {
          const indexJsPath = path.join(templatePath, 'index.js');
          if (fs.existsSync(indexJsPath)) {
            // Clear require cache
            delete nodeRequire.cache[nodeRequire.resolve(indexJsPath)];
            resolvedTemplate = nodeRequire(indexJsPath) as TemplateInterface;
            if (resolvedTemplate) {
              resolveBackgroundPath(resolvedTemplate, templatePath);
            }
          }
        } catch (requireError) {
          logger.debug(
            `Failed to load '${templateName}' as CommonJS: ${
              requireError instanceof Error
                ? requireError.message
                : String(requireError)
            }`,
          );
        }
      }

      if (resolvedTemplate && resolvedTemplate.id) {
        templates[resolvedTemplate.id] = resolvedTemplate;
        logger.debug(
          `Loaded template '${resolvedTemplate.id}' from '${templateName}'`,
        );
      } else if (resolvedTemplate) {
        logger.warn(
          `Template '${templateName}' does not have a valid 'id' property.`,
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to load template '${templateName}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export function getTemplates(
  userTemplateDirectory?: string,
  builtInTemplateDirectory?: string,
): Record<string, TemplateInterface> {
  const templates: Record<string, TemplateInterface> = {};

  // Load built-in templates first
  if (builtInTemplateDirectory) {
    loadTemplatesFromDirectory(builtInTemplateDirectory, templates);
  }

  // Load user templates (can override built-in)
  if (userTemplateDirectory) {
    loadTemplatesFromDirectory(userTemplateDirectory, templates);
  }

  return templates;
}
export function resolveTemplate(
  templateId: string,
  userTemplateDirectory?: string,
  builtInTemplateDirectory?: string,
): TemplateInterface {
  const templates = getTemplates(
    userTemplateDirectory,
    builtInTemplateDirectory,
  );
  if (templateId in templates) {
    return templates[templateId];
  }
  throw new FotoboxError(
    `Template '${templateId}' not found. Available are: '${Object.keys(
      templates,
    ).join(', ')}'`,
    { code: 'MAIN.COLLAGE-MAKER.TEMPLATE_NOT_FOUND', info: { templateId } },
  );
}
