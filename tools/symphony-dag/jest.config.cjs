module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.test\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        diagnostics: true,
      },
    ],
  },
  transformIgnorePatterns: ["dist", "node_modules"],
};
