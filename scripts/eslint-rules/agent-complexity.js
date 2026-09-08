/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const { builtinRules } = require("eslint/use-at-your-own-risk");

const complexityRule = builtinRules.get("complexity");
const baselineCache = new Map();

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function baselineKey(entry) {
  return `${entry.file}:${entry.line}:${entry.column}`;
}

function loadBaseline(context) {
  const option = context.options[0] || {};
  const baselineFile = option.baselineFile;
  if (!baselineFile) return [];

  const baselinePath = path.resolve(process.cwd(), baselineFile);
  if (!baselineCache.has(baselinePath)) {
    baselineCache.set(
      baselinePath,
      JSON.parse(fs.readFileSync(baselinePath, "utf8"))
    );
  }
  return baselineCache.get(baselinePath);
}

module.exports = {
  meta: {
    ...complexityRule.meta,
    docs: {
      ...complexityRule.meta.docs,
      description: "Agent-only cyclomatic complexity rule with baseline.",
    },
    messages: {
      ...complexityRule.meta.messages,
      unusedBaseline:
        "Unused agent complexity baseline entry for {{location}}. Remove the stale baseline entry.",
    },
    schema: [
      {
        oneOf: [
          { type: "integer", minimum: 0 },
          {
            type: "object",
            properties: {
              max: { type: "integer", minimum: 0 },
              maximum: { type: "integer", minimum: 0 },
              baselineFile: { type: "string" },
            },
            additionalProperties: false,
          },
        ],
      },
    ],
  },
  create(context) {
    const filename = normalizePath(
      path.relative(process.cwd(), context.getFilename())
    );
    const baseline = loadBaseline(context).filter(
      (entry) => entry.file === filename
    );
    const baselineKeys = new Set(baseline.map(baselineKey));
    const usedBaselineKeys = new Set();

    const wrappedContext = Object.create(context);
    Object.defineProperty(wrappedContext, "report", {
      value: (descriptor) => {
        const loc = descriptor.loc || descriptor.node.loc.start;
        const candidateKeys = [loc.column, loc.column + 1].map((column) =>
          baselineKey({
            file: filename,
            line: loc.line,
            column,
          })
        );
        const matchedKey = candidateKeys.find((key) => baselineKeys.has(key));
        if (matchedKey) {
          usedBaselineKeys.add(matchedKey);
          return;
        }
        context.report(descriptor);
      },
    });

    const listeners = complexityRule.create(wrappedContext);
    return {
      ...listeners,
      "Program:exit"(node) {
        if (listeners["Program:exit"]) {
          listeners["Program:exit"](node);
        }
        for (const entry of baseline) {
          const key = baselineKey(entry);
          if (usedBaselineKeys.has(key)) continue;
          context.report({
            node,
            messageId: "unusedBaseline",
            data: { location: key },
          });
        }
      },
    };
  },
};
