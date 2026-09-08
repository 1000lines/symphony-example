// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require("./.eslintrc");

module.exports = {
  ...baseConfig,
  rules: {
    ...baseConfig.rules,
    // An adopter can supply a baseline in its own ESLint configuration.
    "agent-complexity": [
      "error",
      {
        max: 10,
      },
    ],
  },
};
