import assert from "node:assert/strict";
import path from "node:path";

import {
  DEFAULT_BASE_REF,
  findScopeViolations,
  HELP_TEXT,
  parseCliArgs,
  runAgentGuardrails,
} from "./agent-guardrails";

function test(name: string, fn: () => void) {
  fn();
  console.info(`ok - ${name}`);
}

test("scope guard allows local Symphony agent guardrail files", () => {
  assert.deepEqual(
    findScopeViolations([
      "docs/agent-note.md",
      ".codex/skills/karpathy-guidelines/SKILL.md",
      ".eslintrc.agent.js",
      "scripts/.gitignore",
      "scripts/agent-guardrails.ts",
      "scripts/agent-guardrails.test.ts",
      "scripts/eslint-agent-complexity-baseline.json",
      "scripts/eslint-rules/agent-complexity.js",
      "package.json",
      "package-lock.json",
    ]),
    []
  );
});

test("scope guard rejects app, CI, and infra paths", () => {
  assert.deepEqual(
    findScopeViolations([
      "application/service.ts",
      ".github/workflows/main.yml",
      "infra/prod.tf",
      "CLAUDE.md",
    ]),
    [
      "application/service.ts",
      ".github/workflows/main.yml",
      "infra/prod.tf",
      "CLAUDE.md",
    ]
  );
});

test("help text describes the guardrail CLI", () => {
  assert.match(HELP_TEXT, /Usage:/);
  assert.match(HELP_TEXT, /--base <ref>/);
  assert.match(HELP_TEXT, /--file <path>/);
  assert.match(HELP_TEXT, /-h, --help/);
  assert.match(HELP_TEXT, /npm run lint:agent/);
  assert.doesNotMatch(HELP_TEXT, /--max-complexity/);
});

test("CLI defaults and overrides are explicit", () => {
  const previousBase = process.env.AGENT_GUARDRAIL_BASE;
  delete process.env.AGENT_GUARDRAIL_BASE;

  try {
    assert.deepEqual(parseCliArgs([]), {
      baseRef: DEFAULT_BASE_REF,
    });
    assert.deepEqual(parseCliArgs(["--help"]), {
      baseRef: DEFAULT_BASE_REF,
      help: true,
    });
    assert.deepEqual(parseCliArgs(["-h"]), {
      baseRef: DEFAULT_BASE_REF,
      help: true,
    });
    assert.deepEqual(
      parseCliArgs(["--base", "main", "--file", "./docs/a.md"]),
      {
        baseRef: "main",
        changedFiles: ["docs/a.md"],
      }
    );
  } finally {
    restoreEnv("AGENT_GUARDRAIL_BASE", previousBase);
  }
});

test("guardrails run lint:agent after scope passes", () => {
  const commands: string[] = [];
  const status = runAgentGuardrails(
    repoRoot(),
    { baseRef: DEFAULT_BASE_REF, changedFiles: ["docs/a.md"] },
    (command, args) => {
      commands.push([command, ...args].join(" "));
      return 0;
    }
  );

  assert.equal(status, 0);
  assert.deepEqual(commands, ["npm run lint:agent"]);
});

test("guardrails stop before lint:agent when scope fails", () => {
  const commands: string[] = [];
  const status = runAgentGuardrails(
    repoRoot(),
    { baseRef: DEFAULT_BASE_REF, changedFiles: ["application/service.ts"] },
    (command, args) => {
      commands.push([command, ...args].join(" "));
      return 0;
    }
  );

  assert.equal(status, 1);
  assert.deepEqual(commands, []);
});

test("guardrails return the lint:agent status", () => {
  const status = runAgentGuardrails(
    repoRoot(),
    {
      baseRef: DEFAULT_BASE_REF,
      changedFiles: ["scripts/agent-guardrails.ts"],
    },
    () => 2
  );

  assert.equal(status, 2);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function repoRoot() {
  return path.resolve(__dirname, "..");
}
