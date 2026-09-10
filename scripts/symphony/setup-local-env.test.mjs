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
    assert.match(result.stdout, /^github\.actor=1000-symphony-bot$/m);
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
    assert.doesNotMatch(result.stdout, /^google\./m);
    assert.match(
      result.stdout,
      /^git\.author=1000-symphony-bot <symphony@example\.invalid>$/m
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
      /GitHub identity mismatch: got example-lead, expected 1000-symphony-bot/
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
  githubLogin = "1000-symphony-bot",
  linearEmail = "linear-bot@example.invalid",
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "symphony-identity-"));
  const binDir = join(root, "bin");
  const codexHome = join(root, "codex-home");
  await mkdir(binDir, { recursive: true });
  await mkdir(codexHome, { recursive: true });

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
      GIT_ASKPASS: fixture.askpass,
      GIT_AUTHOR_NAME: "1000-symphony-bot",
      GIT_AUTHOR_EMAIL: "symphony@example.invalid",
      GIT_COMMITTER_NAME: "1000-symphony-bot",
      GIT_COMMITTER_EMAIL: "symphony@example.invalid",
      SYMPHONY_EXPECTED_LINEAR_EMAIL: "linear-bot@example.invalid",
      SYMPHONY_GIT_AUTHOR_EMAIL: "symphony@example.invalid",
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

test("local App setup materializes a separate signing file and removes inherited PATs", async () => {
  const fixture = await createPreflightFixture();
  const { generateKeyPairSync } = await import("node:crypto");
  const { readFile } = await import("node:fs/promises");
  try {
    const root = dirname(fixture.binDir);
    const appSecret = join(root, "app-secret.json");
    const config = { appId: 4866508, appSlug: "1000lines-symphony", installationId: 101, repositoryId: 123, repository: "example/repo",
      permissions: { contents: "write" }, privateKey: generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } }).privateKey };
    await writeFile(appSecret, JSON.stringify(config), { mode: 0o600 });
    const preload = join(root, "fetch.mjs");
    await writeFile(preload, `globalThis.fetch = async (url) => {
      const path = new URL(url).pathname;
      if (process.env.TEST_APP_DENY) return new Response('{}', {status: 403});
      const payload = path === '/app' ? {id:4866508,slug:'1000lines-symphony'} :
        path.endsWith('/installation') ? {id:101,app_id:4866508,account:{login:'example'},suspended_at:null,permissions:{contents:'write'}} :
        path.endsWith('/access_tokens') ? {token:'opaque-test-installation',expires_at:new Date(Date.now()+3600000).toISOString(),permissions:{contents:'write',metadata:'read'}} :
        path === '/installation/repositories' ? {total_count:1,repositories:[{id:123,full_name:'example/repo'}]} : undefined;
      if (!payload) throw new Error('Unexpected endpoint');
      return new Response(JSON.stringify(payload));
    };`);
    await writeExecutable(join(fixture.binDir, "aws"), `#!/bin/sh
case "$*" in
  *get-caller-identity*) printf '{}';;
  *symphony/github-apps/symphony*) cat "$TEST_APP_SECRET";;
  *symphony/keys*) printf '%s' '{"LINEAR_API_TOKEN":"linear-secret-token","OPENAI_API_KEY":"openai-secret-token","PRESERVED_FIELD":"preserved"}';;
  *) exit 3;;
esac
`);
    await writeExecutable(join(fixture.binDir, "curl"), `#!/bin/sh
case "$*" in
  *api.linear.app*) printf '%s' '{"data":{"viewer":{"id":"viewer","email":"linear-bot@example.invalid"}}}';;
  *api.openai.com/v1/models*) exit 0;;
  *) exit 2;;
esac
`);
    const runtime = join(root, "runtime");
    const env = { PATH: `${fixture.binDir}:${process.env.PATH}`, NODE_OPTIONS: `--import=${preload}`, TEST_APP_SECRET: appSecret,
      SYMPHONY_GITHUB_AUTH_MODE: "app", SYMPHONY_RUNTIME_DIR: runtime, SYMPHONY_HUMAN_LOGIN: "jeremycarroll",
      SYMPHONY_GIT_AUTHOR_EMAIL: "123+1000lines-symphony[bot]@users.noreply.github.com", SYMPHONY_EXPECTED_LINEAR_EMAIL: "linear-bot@example.invalid",
      CADENCE_APP_ID: "4866513", CADENCE_APP_SLUG: "1000lines-cadence", GH_TOKEN: "inherited-pat", GITHUB_TOKEN: "inherited-pat" };
    const command = `source "$1" || exit $?; test -z "\${GITHUB_TOKEN:-}" && test -z "\${GH_TOKEN:-}" && test "$PRESERVED_FIELD" = preserved && test "$GIT_CONFIG_COUNT" = 3 && test "$GIT_AUTHOR_NAME" = '1000lines-symphony[bot]' && test "$(command -v gh)" = "$SYMPHONY_RUNTIME_DIR/bin/gh"`;
    const result = spawnSync("bash", ["-c", command, "setup", setupScript], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /inherited-pat|opaque-test-installation|PRIVATE KEY/);
    assertNoSecrets(result);
    assert.equal(JSON.parse(await readFile(join(runtime, "codex-home", "auth.json"), "utf8")).OPENAI_API_KEY, secretEnv.OPENAI_API_KEY);
    const preflight = runPreflight(fixture, { ...env, SYMPHONY_GITHUB_APP_CONFIG: appSecret, SYMPHONY_GITHUB_APP_CACHE: join(root, "preflight-cache"),
      GIT_AUTHOR_NAME: "1000lines-symphony[bot]", GIT_COMMITTER_NAME: "1000lines-symphony[bot]", GIT_AUTHOR_EMAIL: env.SYMPHONY_GIT_AUTHOR_EMAIL, GIT_COMMITTER_EMAIL: env.SYMPHONY_GIT_AUTHOR_EMAIL });
    assert.equal(preflight.status, 0, preflight.stderr);
    assert.match(preflight.stdout, /github.credential_source=renewable-app-broker/);
    assert.match(preflight.stdout, /github.actor=1000lines-symphony\[bot\]/);
    assertNoSecrets(preflight);
    const denied = spawnSync("bash", ["-c", command, "setup", setupScript], { env: { ...env, TEST_APP_DENY: "1" }, encoding: "utf8" });
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /HTTP 403/);
    assertNoSecrets(denied);
  } finally { await fixture.cleanup(); }
});
