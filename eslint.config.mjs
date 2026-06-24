import baseConfig from './eslint.base.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {},
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
