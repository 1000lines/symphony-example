import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const setupScript = join(scriptDir, "setup-local-env.sh");

const secretEnv = {
  GITHUB_TOKEN: "ghp_fake",
  LINEAR_API_TOKEN: "linear-secret-token",
  OPENAI_API_KEY: "openai-secret-token",
};

test("identity preflight reports expected actors and credential classes", async () => {
  const fixture = await createPreflightFixture();

  try {
    const result = runPreflight(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^github\.actor=example-symphony-bot$/m);
    assert.match(
      result.stdout,
      /^github\.credential_source=env:GITHUB_TOKEN$/m
    );
    assert.match(result.stdout, /^github\.credential_class=classic-pat$/m);
    assert.match(
      result.stdout,
      /^linear\.viewer_email=linear-bot@example\.invalid$/m
    );
    assert.match(
      result.stdout,
      /^linear\.credential_source=env:LINEAR_API_TOKEN$/m
    );
    assert.match(
      result.stdout,
      /^google\.service_account_email=example-doc-reader@example-project\.iam\.gserviceaccount\.com$/m
    );
    assert.match(
      result.stdout,
      /^google\.credential_source=file:GOOGLE_APPLICATION_CREDENTIALS service-account-json$/m
    );
    assert.match(
      result.stdout,
      /^git\.author=example-symphony-bot <symphony@example\.invalid>$/m
    );
    assert.match(result.stdout, /^git\.askpass=executable$/m);
    assert.match(result.stdout, /^git\.ssh_auth_sock=unset$/m);
    assert.match(
      result.stdout,
      /^git\.credential_source=env:GIT_AUTHOR_\*\/GIT_COMMITTER_\* plus env:GIT_ASKPASS$/m
    );
    assert.match(
      result.stdout,
      /^codex\.credential_source=env:OPENAI_API_KEY plus CODEX_HOME$/m
    );
    assertNoSecrets(result);
  } finally {
    await fixture.cleanup();
  }
});

test("identity preflight rejects the wrong GitHub actor without printing tokens", async () => {
  const fixture = await createPreflightFixture({
    githubLogin: "example-lead",
  });

  try {
    const result = runPreflight(fixture, {
      SYMPHONY_EXPECTED_GITHUB_LOGIN: "example-lead",
    });

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /GitHub identity mismatch: got example-lead, expected example-symphony-bot/
    );
    assertNoSecrets(result);
  } finally {
    await fixture.cleanup();
  }
});

test("identity preflight requires the SSH agent to be disabled", async () => {
  const fixture = await createPreflightFixture();

  try {
    const result = runPreflight(fixture, {
      SSH_AUTH_SOCK: "/tmp/operator-agent.sock",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /SSH_AUTH_SOCK is set/);
    assertNoSecrets(result);
  } finally {
    await fixture.cleanup();
  }
});

test("identity preflight requires the bot commit author environment", async () => {
  const fixture = await createPreflightFixture();

  try {
    const result = runPreflight(fixture, {
      GIT_AUTHOR_EMAIL: "human@example.com",
    });

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Git author email mismatch: got human@example\.com, expected symphony@example\.invalid/
    );
    assertNoSecrets(result);
  } finally {
    await fixture.cleanup();
  }
});

test("running setup directly without a preflight mode still instructs the user to source it", () => {
  const result = spawnSync("bash", [setupScript], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Source this script/);
});

async function createPreflightFixture({
  githubLogin = "example-symphony-bot",
  linearEmail = "linear-bot@example.invalid",
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "symphony-identity-"));
  const binDir = join(root, "bin");
  const codexHome = join(root, "codex-home");
  await mkdir(binDir, { recursive: true });
  await mkdir(codexHome, { recursive: true });

  const googleCredentials = join(root, "google-sa.json");
  await writeFile(
    googleCredentials,
    JSON.stringify({
      client_email:
        "example-doc-reader@example-project.iam.gserviceaccount.com",
      project_id: "example-project",
    })
  );

  const askpass = join(root, "git-askpass.sh");
  await writeFile(askpass, "#!/bin/sh\nexit 0\n");
  await chmod(askpass, 0o700);

  await writeExecutable(
    join(binDir, "gh"),
    `#!/bin/sh
if [ "$1" = "api" ] && [ "$2" = "user" ]; then
  printf '%s\\n' "${githubLogin}"
  exit 0
fi
printf 'unexpected gh call\\n' >&2
exit 1
`
  );

  await writeExecutable(
    join(binDir, "curl"),
    `#!/bin/sh
case "$*" in
  *api.linear.app/graphql*)
    printf '%s\\n' '{"data":{"viewer":{"id":"viewer-id","name":"Symphony Bot","email":"${linearEmail}"}}}'
    exit 0
    ;;
esac
printf 'unexpected curl call\\n' >&2
exit 1
`
  );

  return {
    askpass,
    binDir,
    cleanup: () => rm(root, { recursive: true, force: true }),
    codexHome,
    googleCredentials,
  };
}

async function writeExecutable(path, text) {
  await writeFile(path, text);
  await chmod(path, 0o700);
}

function runPreflight(fixture, env = {}) {
  return spawnSync("bash", [setupScript, "--identity-preflight"], {
    encoding: "utf8",
    env: {
      HOME: process.env.HOME,
      PATH: `${fixture.binDir}:${process.env.PATH}`,
      ...secretEnv,
      CODEX_HOME: fixture.codexHome,
      GOOGLE_APPLICATION_CREDENTIALS: fixture.googleCredentials,
      GIT_ASKPASS: fixture.askpass,
      GIT_AUTHOR_NAME: "example-symphony-bot",
      GIT_AUTHOR_EMAIL: "symphony@example.invalid",
      GIT_COMMITTER_NAME: "example-symphony-bot",
      GIT_COMMITTER_EMAIL: "symphony@example.invalid",
      SSH_AUTH_SOCK: "",
      ...env,
    },
  });
}

function assertNoSecrets(result) {
  const output = `${result.stdout}\n${result.stderr}`;

  for (const secret of Object.values(secretEnv)) {
    assert.doesNotMatch(output, new RegExp(escapeRegExp(secret)));
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
