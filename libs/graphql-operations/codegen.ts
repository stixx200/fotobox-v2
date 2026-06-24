import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'libs/graphql-operations/src/schema.graphql',
  documents: 'libs/graphql-operations/src/operations/**/*.graphql',
  generates: {
    'libs/graphql-operations/src/generated/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
