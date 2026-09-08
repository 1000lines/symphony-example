import { execFileSync, spawnSync } from "node:child_process";

export const DEFAULT_BASE_REF = "origin/main";
export const HELP_TEXT = `
Agent guardrails checks the current PR diff before human review.

It fails when changed files leave the local Symphony agent sandbox, then runs
the agent CCN lint guard through npm run lint:agent.

Usage:
  npm run agent:guardrails -- [options]

Options:
  --base <ref>     Git base ref for changed-file detection. Default: ${DEFAULT_BASE_REF}
  --file <path>    Check an explicit changed file. Repeatable.
  -h, --help       Show this help text.
`.trim();

type ScopeRule = {
  label: string;
  matches: (file: string) => boolean;
};

export const allowedScopeRules: ScopeRule[] = [
  {
    label: "docs/**",
    matches: (file) => file.startsWith("docs/"),
  },
  {
    label: ".codex/**",
    matches: (file) => file.startsWith(".codex/"),
  },
  {
    label: ".eslintrc.agent.js",
    matches: (file) => file === ".eslintrc.agent.js",
  },
  {
    label: "scripts/.gitignore guardrail baseline wiring",
    matches: (file) => file === "scripts/.gitignore",
  },
  {
    label: "scripts/agent-*.ts",
    matches: (file) => /^scripts\/agent-[^/]+\.tsx?$/.test(file),
  },
  {
    label: "scripts/eslint-agent-complexity-baseline.json",
    matches: (file) => file === "scripts/eslint-agent-complexity-baseline.json",
  },
  {
    label: "scripts/eslint-rules/**",
    matches: (file) => file.startsWith("scripts/eslint-rules/"),
  },
  {
    label: "package.json/package-lock.json guardrail wiring",
    matches: (file) => file === "package.json" || file === "package-lock.json",
  },
];

export type CliOptions = {
  baseRef: string;
  changedFiles?: string[];
  help?: boolean;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string }
) => number;

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseRef: process.env.AGENT_GUARDRAIL_BASE || DEFAULT_BASE_REF,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--base") {
      options.baseRef = readValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg === "--file") {
      options.changedFiles = [
        ...(options.changedFiles || []),
        normalizeFile(readValue(argv, i, arg)),
      ];
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function readChangedFiles(repoRoot: string, baseRef: string) {
  assertGitRef(repoRoot, baseRef);

  const files = new Set<string>();
  for (const args of [
    ["diff", "--name-only", `${baseRef}...HEAD`],
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    for (const file of gitLines(repoRoot, args)) {
      files.add(normalizeFile(file));
    }
  }

  return [...files].filter(Boolean).sort();
}

export function findScopeViolations(files: string[]) {
  return files
    .map(normalizeFile)
    .filter((file) => !allowedScopeRules.some((rule) => rule.matches(file)));
}

export function runAgentGuardrails(
  repoRoot: string,
  options: CliOptions,
  runCommand: CommandRunner = runCommandWithInheritedStdio
) {
  const changedFiles =
    options.changedFiles || readChangedFiles(repoRoot, options.baseRef);

  if (changedFiles.length === 0) {
    console.info("Agent guardrails: no changed files found.");
    return 0;
  }

  const scopeViolations = findScopeViolations(changedFiles);
  if (scopeViolations.length > 0) {
    console.error("Scope/path guard failed. Out-of-sandbox files:");
    for (const file of scopeViolations) {
      console.error(`- ${file}`);
    }
    console.error("\nAllowed agent-side paths:");
    for (const rule of allowedScopeRules) {
      console.error(`- ${rule.label}`);
    }
    return 1;
  }

  console.info(`Scope/path guard passed for ${changedFiles.length} file(s).`);
  console.info("Running agent CCN lint guard: npm run lint:agent");

  return runCommand("npm", ["run", "lint:agent"], { cwd: repoRoot });
}

function main() {
  const repoRoot = process.cwd();
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.info(HELP_TEXT);
    return;
  }

  process.exitCode = runAgentGuardrails(repoRoot, options);
}

function readValue(argv: string[], index: number, arg: string) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${arg} requires a value`);
  }
  return value;
}

function normalizeFile(file: string) {
  return file.replace(/\\/g, "/").replace(/^\.\//, "");
}

function assertGitRef(repoRoot: string, ref: string) {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    throw new Error(`Git base ref not found: ${ref}`);
  }
}

function gitLines(repoRoot: string, args: string[]) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runCommandWithInheritedStdio(
  command: string,
  args: string[],
  options: { cwd: string }
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
