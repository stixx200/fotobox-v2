const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

const workspaceRoot = join(__dirname, '../..');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/fotobox-api'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/assets',
        // Collage-maker images for runtime access
        {
          input: join(workspaceRoot, 'libs/collage-maker/src/images'),
          glob: '**/*',
          output: 'images',
        },
        // Demo camera images for runtime access
        {
          input: join(workspaceRoot, 'libs/cameras/src/demo'),
          glob: '*.jpg',
          output: 'demo-camera',
        },
        // Collage templates for runtime access
        {
          input: join(workspaceRoot, 'libs/collage-maker/src/templates'),
          glob: '**/*',
          output: 'collage-templates',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
