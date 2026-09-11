import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  inspectConfig,
  validateConfig,
} from "./runtime-bundle/skills/symphony-repository/scripts/config.mjs";

const config = () => ({
  schemaVersion: "symphony-repository/v1",
  linear: { teamKey: "ENG" },
  workingDirectory: ".",
  instructions: ["AGENTS.md"],
  commands: { test: [["cargo", "test", "--workspace"]] },
  ci: {
    requiredChecks: [
      {
        name: "Rust tests",
        workflow: ".github/workflows/checks.yml",
        appId: 15368,
      },
    ],
  },
});

test("repo-owned config specifies the team and development settings without credentials", () => {
  assert.deepEqual(validateConfig(config()), config());
  for (const change of [
    (c) => {
      c.privateKey = "unwanted";
    },
    (c) => {
      c.repository = "owner/other";
    },
    (c) => {
      c.installationId = 1;
    },
    (c) => {
      c.dispatch = {};
    },
    (c) => {
      c.workingDirectory = "../outside";
    },
    (c) => {
      c.instructions = ["/etc/secret"];
    },
    (c) => {
      c.commands.test = ["cargo test"];
    },
    (c) => {
      c.ci.requiredChecks[0].appId = null;
    },
    (c) => {
      c.ci.requiredChecks[0].workflow = ".github/workflows/../other.yml";
    },
    (c) => {
      c.ci.requiredChecks.push(c.ci.requiredChecks[0]);
    },
  ]) {
    const value = config();
    change(value);
    assert.throws(() => validateConfig(value));
  }
});

test("inspection reads fetched base, ignoring task and working-tree proposals", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "repo-config-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_AUTHOR_NAME: "Fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.com",
        GIT_COMMITTER_NAME: "Fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.com",
      },
    }).trim();
  git("init", "--initial-branch=trunk");
  writeFileSync(join(dir, "README.md"), "Repository\n");
  git("add", ".");
  git("commit", "-m", "initial");
  const initial = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/trunk", initial);
  writeFileSync(join(dir, ".symphony.cfg.json"), JSON.stringify(config()));
  assert.deepEqual(inspectConfig(dir, "trunk"), {
    status: "missing",
    revision: initial,
  });
  git("add", ".");
  git("commit", "-m", "propose config");
  assert.equal(inspectConfig(dir, "trunk").status, "missing");
  git("update-ref", "refs/remotes/origin/trunk", "HEAD");
  writeFileSync(join(dir, ".symphony.cfg.json"), "invalid proposal");
  assert.deepEqual(inspectConfig(dir, "trunk").config, config());
  assert.throws(() => inspectConfig(dir, "missing"));
  assert.throws(() => inspectConfig(dir, "trunk:other"));
  git("add", ".");
  git("commit", "-m", "invalid base config");
  git("update-ref", "refs/remotes/origin/trunk", "HEAD");
  assert.throws(() => inspectConfig(dir, "trunk"));
  rmSync(join(dir, ".symphony.cfg.json"));
  symlinkSync("README.md", join(dir, ".symphony.cfg.json"));
  git("add", ".");
  git("commit", "-m", "symlink config");
  git("update-ref", "refs/remotes/origin/trunk", "HEAD");
  assert.throws(() => inspectConfig(dir, "trunk"), /regular file/);
});
