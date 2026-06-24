import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

export default {
  mode: isProd ? 'production' : 'development',
  optimization: {
    minimize: false,
  },
  output: {
    path: join(__dirname, '../../dist/apps/fotobox-electron'),
  },
  plugins: [
    new NxAppRspackPlugin({
      target: 'node',
      outputPath: 'dist/apps/fotobox-electron',
      main: 'apps/fotobox-electron/src/main.ts',
      tsConfig: 'apps/fotobox-electron/tsconfig.app.json',
      outputHashing: 'none',
      generatePackageJson: true,
      assets: ['apps/fotobox-electron/src/assets'],
      additionalEntryPoints: [
        {
          entryName: 'main.preload',
          entryPath: 'apps/fotobox-electron/src/main.preload.ts',
        },
      ],
    }),
  ],
};
