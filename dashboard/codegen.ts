import type { CodegenConfig } from "@graphql-codegen/cli";

// Generates typed GraphQL documents from the backend SDL (the single source of
// truth the gqlgen server emits). Replaces tygo/apiTypes.ts.
const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: ["src/**/*.{ts,tsx}"],
  ignoreNoDocuments: true,
  generates: {
    "src/gql/": {
      preset: "client",
      config: {
        useTypeImports: true,
        scalars: { DateTime: "string" },
      },
    },
  },
};

export default config;
