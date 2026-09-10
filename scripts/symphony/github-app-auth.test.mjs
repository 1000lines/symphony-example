import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdtemp,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  askpassRepository,
  createGitHubAppClient,
  getInstallationToken,
  loadAppConfig,
  pushWithReadback,
  revokeInstallationToken,
} from "./github-app-auth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const start = Date.parse("2026-09-10T12:00:00Z");
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "github-app-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = {
    appId: 4866508,
    appSlug: "1000lines-symphony",
    installationId: 101,
    repositoryId: 123,
    repository: "example/repo",
    privateKey,
    permissions: { contents: "write" },
  };
  const f = {
    root,
    config,
    cacheDir: join(root, "cache"),
    time: start,
    mints: 0,
    calls: [],
    intercept: () => undefined,
  };
  f.now = () => f.time;
  f.fetchImpl = async (url, init) => {
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    const path = new URL(url).pathname;
    f.calls.push({ path, method: init.method });
    const override = await f.intercept(path, init);
    if (override) return override;
    if (path.startsWith("/app") || path.endsWith("/installation")) {
      const [header, payload, signature] = init.headers.authorization
        .slice(7)
        .split(".");
      assert.equal(JSON.parse(Buffer.from(header, "base64url")).alg, "RS256");
      const claims = JSON.parse(Buffer.from(payload, "base64url"));
      assert.equal(claims.iss, config.appId);
      assert.equal(claims.exp - claims.iat, 600);
      assert.ok(
        verify(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          publicKey,
          Buffer.from(signature, "base64url")
        )
      );
    }
    if (path === "/app")
      return response({ id: config.appId, slug: config.appSlug });
    if (path.endsWith("/installation"))
      return response({
        id: config.installationId,
        app_id: config.appId,
        account: { login: "example" },
        suspended_at: null,
        permissions: config.permissions,
      });
    if (path.endsWith("/access_tokens")) {
      assert.deepEqual(JSON.parse(init.body), {
        repository_ids: [config.repositoryId],
        permissions: config.permissions,
      });
      f.mints++;
      return response(
        {
          token: `opaque-installation-${f.mints}`,
          expires_at: new Date(f.time + 3_600_000).toISOString(),
          permissions: { ...config.permissions, metadata: "read" },
        },
        201
      );
    }
    if (path === "/installation/repositories")
      return response({
        total_count: 1,
        repositories: [
          { id: config.repositoryId, full_name: config.repository },
        ],
      });
    return response({ ok: true, credential: init.headers.authorization });
  };
  return f;
}

test("exact scoped JWT acquisition, private cache and five-minute renewal", async (t) => {
  const f = await fixture(t);
  const first = await getInstallationToken(f);
  assert.equal(first.token, "opaque-installation-1");
  assert.equal((await stat(f.cacheDir)).mode & 0o777, 0o700);
  const cacheFile = (await readdir(f.cacheDir))[0];
  assert.equal((await stat(join(f.cacheDir, cacheFile))).mode & 0o777, 0o600);
  f.time += 3_299_999;
  assert.equal((await getInstallationToken(f)).token, first.token);
  f.time++;
  const tokens = await Promise.all(
    Array.from({ length: 12 }, () => getInstallationToken(f))
  );
  assert.equal(f.mints, 2);
  assert.ok(tokens.every(({ token }) => token === "opaque-installation-2"));
  const refreshed = await Promise.all(
    Array.from({ length: 5 }, () =>
      getInstallationToken({ ...f, rejectedToken: tokens[0].token })
    )
  );
  assert.equal(f.mints, 3);
  assert.ok(refreshed.every(({ token }) => token === "opaque-installation-3"));
});

test("long-lived API client obtains fresh credentials across one-hour expiry", async (t) => {
  const f = await fixture(t);
  const client = createGitHubAppClient(f);
  assert.match(
    (await (await client("/pulls")).json()).credential,
    /installation-1$/
  );
  f.time += 3_600_000;
  assert.match(
    (await (await client("/pulls")).json()).credential,
    /installation-2$/
  );
  await assert.rejects(client("/../../other/repo"), /invalid repository/);
  await assert.rejects(
    client("/%2e%2e/%2e%2e/other/repo"),
    /invalid repository/
  );
});

for (const [name, path, payload, status = 200, pattern] of [
  ["revoked", "/app", {}, 401, /HTTP 401/],
  ["unselected", "/repos/example/repo/installation", {}, 404, /HTTP 404/],
  [
    "denied upgrade",
    "/app/installations/101/access_tokens",
    {},
    403,
    /HTTP 403/,
  ],
  [
    "wrong App",
    "/app",
    { id: 1, slug: "impostor" },
    200,
    /App identity mismatch/,
  ],
  [
    "suspended",
    "/repos/example/repo/installation",
    {
      id: 101,
      app_id: 4866508,
      account: { login: "example" },
      suspended_at: "now",
    },
    200,
    /suspended/,
  ],
  [
    "wrong owner",
    "/repos/example/repo/installation",
    { id: 101, app_id: 4866508, account: { login: "elsewhere" } },
    200,
    /owner mismatch/,
  ],
  [
    "wrong installation",
    "/repos/example/repo/installation",
    { id: 102, app_id: 4866508, account: { login: "example" } },
    200,
    /installation/,
  ],
  [
    "missing grant",
    "/repos/example/repo/installation",
    {
      id: 101,
      app_id: 4866508,
      account: { login: "example" },
      suspended_at: null,
      permissions: { contents: "read" },
    },
    200,
    /denied contents:write/,
  ],
  [
    "broad selection",
    "/installation/repositories",
    { total_count: 2, repositories: [] },
    200,
    /scope mismatch/,
  ],
  [
    "wrong repository ID",
    "/installation/repositories",
    { total_count: 1, repositories: [{ id: 2, full_name: "example/repo" }] },
    200,
    /scope mismatch/,
  ],
  [
    "expired token",
    "/app/installations/101/access_tokens",
    {
      token: "expired",
      expires_at: new Date(start).toISOString(),
      permissions: { contents: "write", metadata: "read" },
    },
    201,
    /expiry/,
  ],
  ["missing output", "/app/installations/101/access_tokens", {}, 201, /expiry/],
  [
    "broad permissions",
    "/app/installations/101/access_tokens",
    {
      token: "broad",
      expires_at: new Date(start + 3_600_000).toISOString(),
      permissions: { contents: "write", metadata: "read", issues: "write" },
    },
    201,
    /permission scope/,
  ],
]) {
  test(`${name} fails closed without credential fallback or secret error details`, async (t) => {
    const f = await fixture(t);
    f.intercept = (requested) =>
      requested === path && response(payload, status);
    await assert.rejects(getInstallationToken(f), pattern);
    assert.ok(
      !(await readdir(f.cacheDir)).some((name) => name.endsWith(".json"))
    );
  });
}

test("malformed responses and unsafe cache/config paths fail closed", async (t) => {
  const f = await fixture(t);
  f.intercept = () => new Response("opaque-secret-response");
  await assert.rejects(getInstallationToken(f), /invalid API JSON/);
  await chmod(f.cacheDir, 0o755);
  await assert.rejects(getInstallationToken(f), /unsafe cache/);
  await chmod(f.cacheDir, 0o700);
  const path = join(f.root, "app.json");
  await writeFile(path, JSON.stringify(f.config), { mode: 0o600 });
  const env = {
    SYMPHONY_GITHUB_APP_CONFIG: path,
    SYMPHONY_GITHUB_APP_CACHE: f.cacheDir,
  };
  assert.deepEqual(await loadAppConfig(env), f.config);
  await chmod(path, 0o644);
  await assert.rejects(loadAppConfig(env), /private App/);
  await chmod(path, 0o600);
  await symlink(path, join(f.root, "link.json"));
  await assert.rejects(
    loadAppConfig({
      ...env,
      SYMPHONY_GITHUB_APP_CONFIG: join(f.root, "link.json"),
    }),
    /private App/
  );
});

test("401 reads refresh once; repeated auth and denied grants do not loop", async (t) => {
  const f = await fixture(t);
  let reads = 0;
  f.intercept = (path) =>
    path.endsWith("/pulls") && response({}, ++reads === 1 ? 401 : 200);
  const client = createGitHubAppClient(f);
  assert.equal((await client("/pulls")).status, 200);
  assert.equal(f.mints, 2);
  f.intercept = (path) => path.endsWith("/pulls") && response({}, 401);
  await assert.rejects(client("/pulls"), /after one refresh/);
  assert.equal(f.mints, 3);
  f.intercept = (path) => path.endsWith("/pulls") && response({}, 403);
  assert.equal((await client("/pulls")).status, 403);
  assert.equal(f.mints, 3);
});

for (const applied of [true, false, undefined, "denied", "missing"]) {
  test(`write expiry readback: ${applied}`, async (t) => {
    const f = await fixture(t);
    let writes = 0;
    const order = [];
    f.intercept = (path, init) => {
      if (path.endsWith("/issues/1/comments") && init.method === "POST") {
        order.push("write");
        return response({ id: 123 }, ++writes === 1 ? 401 : 201);
      }
      if (path.endsWith("/issues/1/comments")) {
        order.push("readback");
        return response([{ id: 123 }], applied === "denied" ? 403 : 200);
      }
    };
    const client = createGitHubAppClient(f);
    const write = () =>
      client("/issues/1/comments", {
        method: "POST",
        body: { body: "test" },
        ...(applied === "missing"
          ? {}
          : {
              readback: async (read) => ({
                applied,
                response: await read("/issues/1/comments"),
              }),
            }),
      });
    if (typeof applied === "boolean") {
      assert.ok((await write()).ok);
      assert.deepEqual(
        order,
        applied ? ["write", "readback"] : ["write", "readback", "write"]
      );
    } else {
      await assert.rejects(write(), /readback/);
      assert.equal(writes, 1);
    }
    assert.equal(f.mints, 2);
  });
}

test("Git push verifies remote SHA before one normal retry", async (t) => {
  for (const applied of [true, false]) {
    const f = await fixture(t);
    const calls = [];
    let pushes = 0;
    f.gitImpl = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse") return { stdout: "a".repeat(40) };
      if (args[0] === "ls-remote")
        return {
          stdout: `${(applied ? "a" : "b").repeat(40)}\trefs/heads/test\n`,
        };
      if (++pushes === 1) throw new Error("transport failed");
      return { stdout: "" };
    };
    await pushWithReadback(f, "HEAD", "refs/heads/test");
    assert.deepEqual(
      calls.map(([cmd]) => cmd),
      applied
        ? ["rev-parse", "push", "ls-remote"]
        : ["rev-parse", "push", "ls-remote", "push"]
    );
    assert.ok(
      calls
        .flat()
        .every(
          (arg) =>
            !arg.includes("--force") && !arg.includes("opaque-installation")
        )
    );
  }
});

test("askpass rejects other repositories, hosts, missing paths and credential URLs", async (t) => {
  const f = await fixture(t);
  assert.equal(
    askpassRepository(
      "Password for 'https://x-access-token@github.com/example/repo.git': ",
      f.config
    ),
    "Password"
  );
  for (const target of [
    "https://github.com",
    "https://github.com/other/repo",
    "https://evil.test/example/repo",
    "https://x-access-token:secret@github.com/example/repo",
    "https://github.com/example/repo?secret=x",
  ]) {
    assert.throws(() =>
      askpassRepository(`Password for '${target}': `, f.config)
    );
  }
});

function run(command, args, env, input = "") {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(input);
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("actual askpass/gh/preflight subprocesses serialize renewal without inherited PATs", async (t) => {
  const f = await fixture(t);
  const server = createServer(async (req, res) => {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const result = await f.fetchImpl(`https://api.github.com${req.url}`, {
        headers: req.headers,
        method: req.method,
        body: body || undefined,
        redirect: "error",
        signal: AbortSignal.timeout(1000),
      });
      res.writeHead(result.status, { "content-type": "application/json" });
      res.end(await result.text());
    } catch {
      res.writeHead(500);
      res.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const configPath = join(f.root, "app.json");
  await writeFile(configPath, JSON.stringify(f.config), { mode: 0o600 });
  const preload = join(f.root, "fetch.mjs");
  await writeFile(
    preload,
    `const original = globalThis.fetch; Date.now = () => Number(process.env.TEST_NOW); globalThis.fetch = (url, options) => { if (!String(url).startsWith('https://api.github.com/')) throw new Error('Unexpected host'); return original(String(url).replace('https://api.github.com', process.env.TEST_API), options); };`
  );
  const env = {
    PATH: process.env.PATH,
    NODE_OPTIONS: `--import=${preload}`,
    TEST_API: `http://127.0.0.1:${server.address().port}`,
    TEST_NOW: String(f.time),
    SYMPHONY_GITHUB_APP_CONFIG: configPath,
    SYMPHONY_GITHUB_APP_CACHE: f.cacheDir,
    SYMPHONY_GITHUB_APP_AUTH: join(here, "github-app-auth.mjs"),
    GH_TOKEN: "inherited-pat",
    GITHUB_TOKEN: "inherited-pat",
  };
  const args = [
    env.SYMPHONY_GITHUB_APP_AUTH,
    "askpass",
    "Password for 'https://x-access-token@github.com/example/repo.git': ",
  ];
  const results = await Promise.all(
    Array.from({ length: 6 }, () => run(process.execPath, args, env))
  );
  assert.ok(
    results.every(
      (r) => r.code === 0 && r.stdout.trim() === "opaque-installation-1"
    ),
    JSON.stringify(results)
  );
  assert.equal(f.mints, 1);
  f.time += 3_300_000;
  env.TEST_NOW = String(f.time);
  const gh = join(f.root, "gh");
  await copyFile(join(here, "github-app-exec.sh"), gh);
  await chmod(gh, 0o700);
  const realGh = join(f.root, "real-gh");
  await writeFile(
    realGh,
    `#!/usr/bin/env node\nif (process.env.GH_TOKEN !== 'opaque-installation-2' || process.env.GITHUB_TOKEN !== process.env.GH_TOKEN) process.exit(2); process.stdout.write('fresh credentials\\n');`,
    { mode: 0o700 }
  );
  const executed = await run(gh, ["api", "repos/example/repo"], {
    ...env,
    SYMPHONY_GH_BIN: realGh,
  });
  assert.equal(executed.code, 0, executed.stderr);
  assert.equal(executed.stdout, "fresh credentials\n");
  assert.equal(f.mints, 2);
  const askpass = join(f.root, "askpass");
  await writeFile(
    askpass,
    '#!/bin/sh\nexec node "$SYMPHONY_GITHUB_APP_AUTH" askpass "$1"\n',
    { mode: 0o700 }
  );
  const filled = await run(
    "git",
    [
      "-c",
      "credential.helper=",
      "-c",
      "credential.useHttpPath=true",
      "credential",
      "fill",
    ],
    {
      ...env,
      GIT_ASKPASS: askpass,
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
    "protocol=https\nhost=github.com\npath=example/repo.git\n\n"
  );
  assert.equal(filled.code, 0, filled.stderr);
  assert.match(filled.stdout, /username=x-access-token/);
  assert.match(filled.stdout, /password=opaque-installation-2/);
  assert.equal(f.mints, 2);
  const preflight = await run(
    process.execPath,
    [env.SYMPHONY_GITHUB_APP_AUTH, "preflight"],
    env
  );
  assert.equal(preflight.code, 0, preflight.stderr);
  assert.equal(JSON.parse(preflight.stdout).appId, f.config.appId);
  assert.doesNotMatch(
    preflight.stdout + preflight.stderr,
    /opaque-installation|PRIVATE KEY|inherited-pat/
  );
  f.intercept = (path) =>
    path === "/app" && response({ secret: "do-not-print" }, 401);
  const denied = await run(
    process.execPath,
    [env.SYMPHONY_GITHUB_APP_AUTH, "preflight"],
    env
  );
  assert.equal(denied.code, 1);
  assert.match(denied.stderr, /HTTP 401/);
  assert.doesNotMatch(
    denied.stdout + denied.stderr,
    /opaque-installation|PRIVATE KEY|inherited-pat|do-not-print/
  );
  assert.equal((await readdir(f.cacheDir)).length, 0);
});

test("job cleanup revokes the actual token and preserves a peer's newer cache", async (t) => {
  const f = await fixture(t);
  const old = await getInstallationToken(f);
  const current = await getInstallationToken({
    ...f,
    rejectedToken: old.token,
  });
  f.intercept = (path, init) => {
    if (path !== "/installation/token") return;
    assert.equal(init.method, "DELETE");
    return new Response(null, { status: 204 });
  };
  await revokeInstallationToken(f, old);
  assert.equal((await getInstallationToken(f)).token, current.token);
  assert.equal(f.mints, 2);
  await revokeInstallationToken(f, current);
  assert.deepEqual(await readdir(f.cacheDir), []);
});
