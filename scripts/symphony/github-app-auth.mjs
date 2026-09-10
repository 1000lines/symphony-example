#!/usr/bin/env node
// Trusted callers supply one target, never configuration taken from PR/event text.
// Config JSON: appId, appSlug, installationId, repositoryId, repository (owner/name),
// privateKey (PEM), permissions (exact operation grants). SYMPHONY_GITHUB_APP_CONFIG
// points to that private file; SYMPHONY_GITHUB_APP_CACHE points to a private directory.
// GATE owns target selection. This broker verifies that GitHub agrees with it.
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID, sign } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const API = "https://api.github.com";
const REFRESH_MS = 300_000;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const grants = new Set([
  "actions",
  "checks",
  "contents",
  "issues",
  "pull_requests",
  "statuses",
  "workflows",
  "metadata",
]);
class AppAuthError extends Error {}
const fail = (message) => {
  throw new AppAuthError(`GitHub App: ${message}`);
};
const digest = (value) => createHash("sha256").update(value).digest("hex");
const cachePath = (directory, config) =>
  join(
    directory,
    `${digest(
      JSON.stringify([
        config.appId,
        config.appSlug,
        config.installationId,
        config.repositoryId,
        config.repository,
        Object.entries(config.permissions).sort(),
        digest(config.privateKey),
      ])
    )}.json`
  );

export function validateAppConfig(config) {
  if (
    !config ||
    ![config.appId, config.installationId, config.repositoryId].every(
      (id) => Number.isSafeInteger(id) && id > 0
    ) ||
    !/^[a-z0-9-]+$/.test(config.appSlug || "") ||
    !repositoryPattern.test(config.repository || "") ||
    config.repository.split("/").some((part) => [".", ".."].includes(part)) ||
    typeof config.privateKey !== "string" ||
    !config.privateKey.includes("PRIVATE KEY")
  )
    fail("invalid target/signing configuration");
  if (
    !config.permissions ||
    !Object.keys(config.permissions).length ||
    Object.entries(config.permissions).some(
      ([name, level]) => !grants.has(name) || !["read", "write"].includes(level)
    )
  )
    fail("invalid operation permissions");
  return config;
}

export async function loadAppConfig(env = process.env) {
  if (!env.SYMPHONY_GITHUB_APP_CONFIG || !env.SYMPHONY_GITHUB_APP_CACHE)
    fail("configuration and private cache paths are required");
  try {
    const stat = await lstat(env.SYMPHONY_GITHUB_APP_CONFIG);
    // Host material is root-owned, runtime-group-readable; never world-readable.
    if (!stat.isFile() || stat.mode & 0o007 || stat.mode & 0o022)
      fail("unsafe configuration permissions");
    return validateAppConfig(
      JSON.parse(await readFile(env.SYMPHONY_GITHUB_APP_CONFIG, "utf8"))
    );
  } catch {
    fail("cannot read valid private App configuration");
  }
}

async function request(fetchImpl, path, token, method = "GET", body) {
  let response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    fail("API request failed or timed out");
  }
  return response;
}

async function json(response) {
  if (!response.ok)
    fail(
      `HTTP ${response.status} (expired/revoked, suspended, unselected repository or denied grant; no credential fallback)`
    );
  try {
    return await response.json();
  } catch {
    fail("invalid API JSON response");
  }
}

function jwt(config, now) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iat: Math.floor(now / 1000) - 60,
    exp: Math.floor(now / 1000) + 540,
    iss: config.appId,
  })}`;
  try {
    return `${data}.${sign(
      "RSA-SHA256",
      Buffer.from(data),
      config.privateKey
    ).toString("base64url")}`;
  } catch {
    fail("invalid signing key");
  }
}

function exactPermissions(actual, requested) {
  const expected = { ...requested, metadata: "read" };
  return (
    actual &&
    Object.entries(expected).every(([key, value]) => actual[key] === value) &&
    Object.keys(actual).every((key) => expected[key] === actual[key])
  );
}

async function mint(config, fetchImpl, now) {
  const signingToken = jwt(config, now());
  const app = await json(await request(fetchImpl, "/app", signingToken));
  if (app.id !== config.appId || app.slug !== config.appSlug)
    fail("App identity mismatch");
  const installation = await json(
    await request(
      fetchImpl,
      `/repos/${config.repository}/installation`,
      signingToken
    )
  );
  if (
    installation.id !== config.installationId ||
    installation.app_id !== config.appId ||
    installation.account?.login?.toLowerCase() !==
      config.repository.split("/")[0].toLowerCase()
  )
    fail("installation/owner mismatch");
  if (installation.suspended_at !== null)
    fail("installation suspended or suspension status missing");
  for (const [permission, level] of Object.entries(config.permissions)) {
    if (![level, "write"].includes(installation.permissions?.[permission]))
      fail(
        `installation denied ${permission}:${level}; owner approval required`
      );
  }
  const result = await json(
    await request(
      fetchImpl,
      `/app/installations/${config.installationId}/access_tokens`,
      signingToken,
      "POST",
      {
        repository_ids: [config.repositoryId],
        permissions: config.permissions,
      }
    )
  );
  const expiresAt = Date.parse(result.expires_at);
  if (
    typeof result.token !== "string" ||
    !result.token ||
    /\s/.test(result.token) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now() + REFRESH_MS ||
    expiresAt > now() + 3_660_000 ||
    !exactPermissions(result.permissions, config.permissions)
  )
    fail("invalid token expiry or permission scope");
  // Verify the actual token scope even when access_tokens omits repositories.
  const selection = await json(
    await request(
      fetchImpl,
      "/installation/repositories?per_page=100",
      result.token
    )
  );
  if (
    selection.total_count !== 1 ||
    selection.repositories?.length !== 1 ||
    selection.repositories[0].id !== config.repositoryId ||
    selection.repositories[0].full_name?.toLowerCase() !==
      config.repository.toLowerCase()
  )
    fail("token repository scope mismatch");
  return { token: result.token, expires_at: result.expires_at };
}

async function privateCache(directory) {
  if (!directory) fail("private cache directory is required");
  await mkdir(directory, { mode: 0o700, recursive: true });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.mode & 0o077 || stat.uid !== process.getuid())
    fail("unsafe cache directory");
}

// mkdir is atomic across processes. Never steal a lock by age: that can race a
// slow signer. A crashed refresher leaves a visible, bounded operator handoff.
async function locked(directory, config, action) {
  await privateCache(directory);
  const lock = join(directory, `${config.appId}-${config.installationId}.lock`);
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      await mkdir(lock, { mode: 0o700 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") fail("cannot lock private cache");
      if (Date.now() >= deadline)
        fail(
          "refresh lock timeout; operator must inspect interrupted refresher"
        );
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try {
    return await action();
  } finally {
    await rm(lock, { recursive: true });
  }
}

// Returns { token, expires_at }. Never log this object. rejectedToken coalesces
// simultaneous 401 refreshes without invalidating a newer token from a peer.
export async function getInstallationToken({
  config,
  cacheDir,
  fetchImpl = fetch,
  now = Date.now,
  rejectedToken,
  forceRefresh = false,
}) {
  validateAppConfig(config);
  return locked(cacheDir, config, async () => {
    const path = cachePath(cacheDir, config);
    let cached;
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.mode & 0o077 || stat.uid !== process.getuid())
        fail("unsafe cached token file");
      cached = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") fail("invalid private token cache");
    }
    if (
      !forceRefresh &&
      typeof cached?.token === "string" &&
      cached.token &&
      cached.token !== rejectedToken &&
      Date.parse(cached.expires_at) > now() + REFRESH_MS &&
      Date.parse(cached.expires_at) <= now() + 3_660_000
    )
      return cached;
    // Retire rejected/expired material before minting; denial cannot revive it.
    await rm(path, { force: true });
    const current = await mint(config, fetchImpl, now);
    const temp = `${path}.${randomUUID()}`;
    try {
      await writeFile(temp, JSON.stringify(current), {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
    return current;
  });
}

// The returned request function is safe to keep for the lifetime of a worker.
// Paths are relative to the configured repository. 403/404 never trigger retries.
// A write's readback returns { applied: true, response } or { applied: false }.
// Unknown, missing or failed readback prohibits replay. Only one 401 retry.
export function createGitHubAppClient(options) {
  const { config, fetchImpl = fetch } = options;
  validateAppConfig(config);
  const endpointFor = (path) => {
    if (
      !path.startsWith("/") ||
      path.includes("..") ||
      /[\\#\r\n]|%2e|%5c/i.test(path.split("?")[0])
    )
      fail("invalid repository API path");
    const endpoint = `/repos/${config.repository}${path}`;
    if (
      !new URL(endpoint, API).pathname.startsWith(
        `/repos/${config.repository}/`
      )
    )
      fail("invalid repository API path");
    return endpoint;
  };
  return async (path, { method = "GET", body, readback } = {}) => {
    const endpoint = endpointFor(path);
    let credential = await getInstallationToken(options);
    let response = await request(
      fetchImpl,
      endpoint,
      credential.token,
      method,
      body
    );
    if (response.status !== 401) return response;
    credential = await getInstallationToken({
      ...options,
      rejectedToken: credential.token,
    });
    if (!["GET", "HEAD"].includes(method.toUpperCase())) {
      if (!readback)
        fail("write outcome unknown; readback required before retry");
      const outcome = await readback(async (readPath) => {
        const observed = await request(
          fetchImpl,
          endpointFor(readPath),
          credential.token
        );
        if (!observed.ok) fail("write readback failed");
        return observed;
      });
      if (outcome?.applied === true && outcome.response)
        return outcome.response;
      if (outcome?.applied !== false) fail("write readback inconclusive");
    }
    response = await request(
      fetchImpl,
      endpoint,
      credential.token,
      method,
      body
    );
    if (response.status === 401)
      fail("authentication failed after one refresh");
    return response;
  };
}

// Actions consumers call this in finally with the credential they actually used.
// Do not mint a replacement merely to revoke it, or delete a peer's newer token.
export async function revokeInstallationToken(options, credential) {
  validateAppConfig(options.config);
  if (!credential?.token) fail("credential to revoke is required");
  return locked(options.cacheDir, options.config, async () => {
    const response = await request(
      options.fetchImpl || fetch,
      "/installation/token",
      credential.token,
      "DELETE"
    );
    if (response.status !== 204)
      fail(`token revocation HTTP ${response.status}`);
    const path = cachePath(options.cacheDir, options.config);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.mode & 0o077) fail("unsafe cached token file");
      const cached = JSON.parse(await readFile(path, "utf8"));
      if (cached.token === credential.token) await rm(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  });
}

export function askpassRepository(prompt, config) {
  const match = /^(Username|Password) for '(https:\/\/[^']+)':\s*$/.exec(
    prompt
  );
  if (!match) fail("unsupported Git credential prompt");
  const url = new URL(match[2]);
  if (
    url.hostname !== "github.com" ||
    url.port ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "x-access-token"].includes(url.username) ||
    url.pathname
      .replace(/^\//, "")
      .replace(/\.git\/?$/, "")
      .toLowerCase() !== config.repository.toLowerCase()
  )
    fail("Git credential target mismatch; credential.useHttpPath is required");
  return match[1];
}

export async function pushWithReadback(options, source, destination) {
  if (
    !/^[A-Za-z0-9_./-]+$/.test(source || "") ||
    source.startsWith("-") ||
    !/^refs\/heads\/[A-Za-z0-9_./-]+$/.test(destination || "")
  )
    fail("explicit push source and branch ref required");
  const remote = `https://github.com/${options.config.repository}.git`;
  let credential;
  const invoke =
    options.gitImpl ||
    (async (args) => {
      if (process.env.SYMPHONY_GITHUB_AUTH_MODE !== "app" || !process.env.GIT_ASKPASS) {
        fail("push requires the configured App Git transport");
      }
      try {
        return await runFile(
          "git",
          [
            "-c",
            "credential.helper=",
            "-c",
            "credential.useHttpPath=true",
            ...args,
          ],
          {
            env: {
              ...process.env,
              GH_TOKEN: credential?.token || "",
              GITHUB_TOKEN: credential?.token || "",
              GIT_TERMINAL_PROMPT: "0",
              SSH_AUTH_SOCK: "",
              GIT_TRACE: "",
              GIT_TRACE_CURL: "",
              GIT_CURL_VERBOSE: "",
            },
          }
        );
      } catch {
        fail("Git operation failed; no credential fallback");
      }
    });
  const expected = (
    await invoke(["rev-parse", `${source}^{commit}`])
  ).stdout.trim();
  credential = await getInstallationToken(options);
  try {
    await invoke(["push", remote, `${expected}:${destination}`]);
    return;
  } catch {
    // A transport failure can hide a completed push. Refresh/revalidate once,
    // observe the remote before replay. A normal push preserves concurrent work.
    credential = await getInstallationToken({ ...options, rejectedToken: credential.token });
    const observed = (
      await invoke(["ls-remote", "--refs", remote, destination])
    ).stdout.trim();
    if (observed.split(/\s+/)[0] === expected) return;
    const old = observed ? observed.split(/\s+/)[0] : "";
    if (old && !/^[a-f0-9]{40}$/.test(old)) fail("invalid remote SHA readback");
    await invoke(["push", remote, `${expected}:${destination}`]);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const config = await loadAppConfig();
  const options = { config, cacheDir: process.env.SYMPHONY_GITHUB_APP_CACHE };
  if (command === "preflight") {
    const { expires_at } = await getInstallationToken({
      ...options,
      forceRefresh: true,
    });
    process.stdout.write(
      `${JSON.stringify({
        appId: config.appId,
        appSlug: config.appSlug,
        installationId: config.installationId,
        repositoryId: config.repositoryId,
        repository: config.repository,
        permissions: config.permissions,
        expires_at,
      })}\n`
    );
  } else if (command === "askpass") {
    const kind = askpassRepository(args[0], config);
    process.stdout.write(
      kind === "Username"
        ? "x-access-token\n"
        : `${(await getInstallationToken(options)).token}\n`
    );
  } else if (command === "push") {
    await pushWithReadback(options, ...args);
  } else if (command === "exec" && args.length) {
    const { token } = await getInstallationToken(options);
    const child = spawn(args[0], args.slice(1), {
      stdio: "inherit",
      env: {
        ...process.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
        GH_HOST: "github.com",
        GH_DEBUG: "",
        GIT_TRACE: "",
        GIT_TRACE_CURL: "",
        GIT_CURL_VERBOSE: "",
      },
    });
    child.on("error", () => {
      process.stderr.write("GitHub App: command could not start\n");
      process.exitCode = 1;
    });
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  } else
    fail(
      "usage: preflight | askpass PROMPT | exec COMMAND ARGS... | push SOURCE refs/heads/BRANCH"
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Node/OpenSSL/filesystem errors can contain credential material or paths.
    process.stderr.write(
      `${
        error instanceof AppAuthError
          ? error.message
          : "GitHub App: operation failed; verify private configuration and cache health"
      }. No credential fallback.\n`
    );
    process.exitCode = 1;
  });
}
