import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:util',
                'type:data-access',
                'type:feature',
              ],
            },
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: [
                'type:app',
                'type:util',
                'type:data-access',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:util',
                'type:data-access',
              ],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:util', 'type:data-access'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:data-access'],
            },
            {
              sourceTag: 'scope:client',
              onlyDependOnLibsWithTags: [
                'scope:client',
                'scope:shared',
                'scope:core',
              ],
            },
            {
              sourceTag: 'scope:server',
              onlyDependOnLibsWithTags: [
                'scope:server',
                'scope:shared',
                'scope:core',
              ],
            },
            {
              sourceTag: 'platform:angular',
              onlyDependOnLibsWithTags: [
                'platform:angular',
                'platform:universal',
              ],
            },
            {
              sourceTag: 'platform:node',
              onlyDependOnLibsWithTags: ['platform:node', 'platform:universal'],
            },
            {
              sourceTag: 'platform:electron',
              onlyDependOnLibsWithTags: [
                'platform:electron',
                'platform:node',
                'platform:universal',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];
