import fs from 'node:fs';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '@fotobox/nest-settings';

/**
 * Resolves the built-in collage template directory shipped with the API build
 * (next to the bundle in the desktop sidecar, or under dist/ in development).
 */
export function resolveBuiltInTemplateDirectory(config: ConfigService): string {
  const configuredDirectory = config.get<string>('builtInTemplateDirectory');
  const candidates = [
    configuredDirectory,
    process.env['FOTOBOX_BUILTIN_TEMPLATE_DIR'],
    path.join(__dirname, 'collage-templates'),
    path.join(process.cwd(), 'dist/apps/fotobox-api/collage-templates'),
  ].filter((candidate): candidate is string => !!candidate);

  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ??
    candidates[0] ??
    path.join(process.cwd(), 'dist/apps/fotobox-api/collage-templates')
  );
}

/**
 * Resolves the user collage template directory from an explicit override or settings.
 */
export async function resolveCollageDirectory(
  settingsService: SettingsService,
  collageDirectory?: string,
): Promise<string | undefined> {
  if (collageDirectory) {
    return collageDirectory;
  }
  const directory = await settingsService.getParsed<string | undefined>(
    'collageDirectory',
    undefined,
  );
  return directory || undefined;
}
