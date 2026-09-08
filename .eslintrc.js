module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  overrides: [
    {
      files: ["**/*.test.mjs"],
      rules: {
        "no-regex-spaces": "off",
      },
    },
    {
      files: ["**/*.cjs"],
      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
  ignorePatterns: ["**/dist/*", "**/node_modules/*"],
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    eqeqeq: ["error", "smart"],
    "no-console": [
      "warn",
      {
        allow: ["warn", "error", "info"],
      },
    ],
  },
};
