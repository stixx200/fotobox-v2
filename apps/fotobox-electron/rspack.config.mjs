import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const devkit = require('@nx/devkit');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  output: {
    path: join(__dirname, '../../dist/apps/fotobox-electron'),
  },
  plugins: [
    new NxAppRspackPlugin({
      target: 'node',
      outputPath: 'dist/apps/fotobox-electron',
      index: 'apps/fotobox-electron/src/index.html',
      main: 'apps/fotobox-electron/src/main.ts',
      tsConfig: 'apps/fotobox-electron/tsconfig.app.json',
      outputHashing: 'none',
      generatePackageJson: true,
      assets: [
        'apps/fotobox-electron/src/assets',
        // Use input/glob/output syntax for file not within project source directory
        {
          input: join(devkit.workspaceRoot, 'dist/apps/fotobox-ui'),
          glob: '**/*',
          output: 'fotobox-ui',
        },
        {
          input: join(devkit.workspaceRoot, 'dist/apps/collage-editor-ui/browser'),
          glob: '**/*',
          output: 'collage-editor-ui',
        },
        // Copy collage-maker images for runtime access
        {
          input: join(devkit.workspaceRoot, 'libs/collage-maker/src/images'),
          glob: '**/*',
          output: 'images',
        },
        // Copy demo camera images for runtime access
        {
          input: join(devkit.workspaceRoot, 'libs/cameras/src/demo'),
          glob: '*.jpg',
          output: 'demo-camera',
        },
        // Copy collage templates for runtime access
        {
          input: join(devkit.workspaceRoot, 'libs/collage-maker/src/templates'),
          glob: '**/*',
          output: 'collage-templates',
        },
        {
          input: join(devkit.workspaceRoot, 'libs/nest/database/drizzle'),
          glob: '**/*',
          output: 'drizzle',
        },
      ],
      additionalEntryPoints: [
        {
          entryName: 'main.preload',
          entryPath: 'apps/fotobox-electron/src/main.preload.ts',
        },
      ],
    }),
  ],
};
