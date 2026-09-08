import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "init-workspace-volume.sh"
);

const currentUser = userInfo().username;
const currentGroup = spawnSync("id", ["-gn"], { encoding: "utf8" }).stdout.trim();

const runScript = (env) =>
  spawnSync("bash", [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      SYMPHONY_WORKSPACE_USER: currentUser,
      SYMPHONY_WORKSPACE_GROUP: currentGroup,
      ...env,
    },
  });

const writeExecutable = async (path, contents) => {
  await writeFile(path, contents);
  await chmod(path, 0o755);
};

test("initializes the blank workspace directory layout without mounting", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-workspace-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const logLink = join(tempRoot, "var", "log", "symphony");

  try {
    const result = runScript({
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
      SYMPHONY_WORKSPACE_LOG_LINK: logLink,
      SYMPHONY_WORKSPACE_SKIP_MOUNT: "1",
      SYMPHONY_WORKSPACE_MANAGE_FSTAB: "0",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Initialized Symphony workspace cache/);

    for (const dir of ["workspaces", "sessions", "artifacts", "cache", "logs"]) {
      const entry = await stat(join(workspaceRoot, dir));
      assert.equal(entry.isDirectory(), true);
      assert.equal(entry.mode & 0o777, 0o750);
      assert.equal(entry.uid, process.getuid());
      assert.equal(entry.gid, process.getgid());
    }

    assert.equal(await readlink(logLink), join(workspaceRoot, "logs"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("writes an fstab entry that mounts by the stable workspace label", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-fstab-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");

  try {
    const result = runScript({
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_SKIP_MOUNT: "1",
      SYMPHONY_WORKSPACE_MANAGE_FSTAB: "1",
    });

    assert.equal(result.status, 0, result.stderr);

    const fstab = await readFile(fstabPath, "utf8");
    assert.equal(
      fstab,
      `LABEL=SYMPHONYWS ${workspaceRoot} xfs defaults,nofail 0 2\n`
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("mounts an existing explicit device without formatting it", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-device-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const devicePath = join(tempRoot, "dev", "test-workspace");
  const logPath = join(tempRoot, "commands.log");

  try {
    await mkdir(binDir);
    await mkdir(dirname(devicePath), { recursive: true });
    await writeFile(devicePath, "");
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await writeExecutable(
      join(binDir, "mkfs.xfs"),
      `#!/usr/bin/env bash\nprintf 'mkfs %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${logPath}"\n`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_DEVICE: devicePath,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(fstabPath, "utf8"),
      `${devicePath} ${workspaceRoot} xfs defaults,nofail 0 2\n`,
    );
    assert.equal(
      await readFile(logPath, "utf8"),
      `mount ${devicePath} ${workspaceRoot}\n`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("formats a blank explicit device and persists future mounts by label", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-blank-device-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const devicePath = join(tempRoot, "dev", "blank-workspace");
  const logPath = join(tempRoot, "commands.log");

  try {
    await mkdir(binDir);
    await mkdir(dirname(devicePath), { recursive: true });
    await writeFile(devicePath, "");
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 2\n",
    );
    await writeExecutable(
      join(binDir, "mkfs.xfs"),
      `#!/usr/bin/env bash\nprintf 'mkfs %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${logPath}"\n`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_DEVICE: devicePath,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(fstabPath, "utf8"),
      `LABEL=SYMPHONYWS ${workspaceRoot} xfs defaults,nofail 0 2\n`,
    );
    assert.equal(
      await readFile(logPath, "utf8"),
      `mkfs -f -L SYMPHONYWS ${devicePath}\nmount ${devicePath} ${workspaceRoot}\n`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("discovers one blank unmounted disk when no label exists", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-discover-disk-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const logPath = join(tempRoot, "commands.log");
  const lsblkLog = join(tempRoot, "lsblk.log");
  const workspaceLabel = "SYMPHONYWS_TEST";

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 2\n",
    );
    await writeExecutable(
      join(binDir, "mkfs.xfs"),
      `#!/usr/bin/env bash\nprintf 'mkfs %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >"${lsblkLog}"
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
NAME="/dev/nvme1n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
LSBLK
`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_LABEL: workspaceLabel,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(fstabPath, "utf8"),
      `LABEL=${workspaceLabel} ${workspaceRoot} xfs defaults,nofail 0 2\n`
    );
    assert.equal(
      await readFile(logPath, "utf8"),
      `mkfs -f -L ${workspaceLabel} /dev/nvme1n1\nmount /dev/nvme1n1 ${workspaceRoot}\n`
    );
    assert.doesNotMatch(await readFile(lsblkLog, "utf8"), /(^| )-r( |$)|--raw/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("waits for a late labelled workspace volume and does not format it", async () => {
  const tempRoot = await mkdtemp(
    join(tmpdir(), "symphony-late-labelled-disk-"),
  );
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const devicePath = join(tempRoot, "dev", "labelled-workspace");
  const findfsCount = join(tempRoot, "findfs-count");
  const logPath = join(tempRoot, "commands.log");
  const sleepLog = join(tempRoot, "sleep.log");
  const workspaceLabel = "SYMPHONYWS_LABEL_WAIT";

  try {
    await mkdir(binDir);
    await mkdir(dirname(devicePath), { recursive: true });
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "findfs"),
      `#!/usr/bin/env bash
count=0
if [[ -f "${findfsCount}" ]]; then count="$(cat "${findfsCount}")"; fi
count=$((count + 1))
printf '%s' "$count" >"${findfsCount}"
if [[ "$count" -lt 2 ]]; then exit 1; fi
printf '${devicePath}\\n'
`,
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
`,
    );
    await writeExecutable(
      join(binDir, "blkid"),
      `#!/usr/bin/env bash
if [[ "$1" == "-s" ]]; then
  printf '${workspaceLabel}\\n'
fi
exit 0
`,
    );
    await writeExecutable(
      join(binDir, "mkfs.xfs"),
      `#!/usr/bin/env bash\nprintf 'mkfs %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash\nprintf 'sleep %s\\n' "$*" >>"${sleepLog}"\n`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
      SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "3",
      SYMPHONY_WORKSPACE_LABEL: workspaceLabel,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(fstabPath, "utf8"),
      `LABEL=${workspaceLabel} ${workspaceRoot} xfs defaults,nofail 0 2\n`,
    );
    assert.equal(
      await readFile(logPath, "utf8"),
      `mount ${devicePath} ${workspaceRoot}\n`,
    );
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\n");
    assert.match(result.stderr, /waiting for workspace device/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("waits for a late explicit workspace device before mounting it", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-late-explicit-disk-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const devicePath = join(tempRoot, "dev", "workspace");
  const logPath = join(tempRoot, "commands.log");
  const sleepLog = join(tempRoot, "sleep.log");

  try {
    await mkdir(binDir);
    await mkdir(dirname(devicePath), { recursive: true });
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash
printf 'sleep %s\\n' "$*" >>"${sleepLog}"
: >"${devicePath}"
`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_DEVICE: devicePath,
      SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
      SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "3",
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(fstabPath, "utf8"),
      `${devicePath} ${workspaceRoot} xfs defaults,nofail 0 2\n`,
    );
    assert.equal(
      await readFile(logPath, "utf8"),
      `mount ${devicePath} ${workspaceRoot}\n`,
    );
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\n");
    assert.match(result.stderr, new RegExp(`device=${devicePath}`));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("waits for a late blank workspace disk and formats it", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-late-blank-disk-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const devicePath = join(tempRoot, "dev", "blank-workspace");
  const lsblkCount = join(tempRoot, "lsblk-count");
  const logPath = join(tempRoot, "commands.log");
  const sleepLog = join(tempRoot, "sleep.log");
  const workspaceLabel = "SYMPHONYWS_BLANK_WAIT";

  try {
    await mkdir(binDir);
    await mkdir(dirname(devicePath), { recursive: true });
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
count=0
if [[ -f "${lsblkCount}" ]]; then count="$(cat "${lsblkCount}")"; fi
count=$((count + 1))
printf '%s' "$count" >"${lsblkCount}"
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
if [[ "$count" -ge 2 ]]; then
  printf 'NAME="${devicePath}" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""\\n'
fi
`,
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 2\n",
    );
    await writeExecutable(
      join(binDir, "mkfs.xfs"),
      `#!/usr/bin/env bash\nprintf 'mkfs %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${logPath}"\n`,
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash\nprintf 'sleep %s\\n' "$*" >>"${sleepLog}"\n`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
      SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "3",
      SYMPHONY_WORKSPACE_LABEL: workspaceLabel,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(fstabPath, "utf8"),
      `LABEL=${workspaceLabel} ${workspaceRoot} xfs defaults,nofail 0 2\n`,
    );
    assert.equal(
      await readFile(logPath, "utf8"),
      `mkfs -f -L ${workspaceLabel} ${devicePath}\nmount ${devicePath} ${workspaceRoot}\n`,
    );
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\n");
    assert.match(result.stderr, /waiting for workspace device/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("times out waiting for a workspace device and names the missing label", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-init-timeout-"));
  const workspaceRoot = join(tempRoot, "var", "lib", "symphony");
  const fstabPath = join(tempRoot, "etc", "fstab");
  const binDir = join(tempRoot, "bin");
  const sleepLog = join(tempRoot, "sleep.log");

  try {
    await mkdir(binDir);
    await writeExecutable(
      join(binDir, "mountpoint"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "findfs"),
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeExecutable(
      join(binDir, "lsblk"),
      `#!/usr/bin/env bash
cat <<'LSBLK'
NAME="/dev/nvme0n1" PKNAME="" TYPE="disk" FSTYPE="" MOUNTPOINT=""
NAME="/dev/nvme0n1p1" PKNAME="/dev/nvme0n1" TYPE="part" FSTYPE="xfs" MOUNTPOINT="/"
LSBLK
`,
    );
    await writeExecutable(
      join(binDir, "blkid"),
      "#!/usr/bin/env bash\nexit 2\n",
    );
    await writeExecutable(
      join(binDir, "mount"),
      `#!/usr/bin/env bash\nprintf 'mount %s\\n' "$*" >>"${sleepLog}.mount"\n`,
    );
    await writeExecutable(
      join(binDir, "sleep"),
      `#!/usr/bin/env bash\nprintf 'sleep %s\\n' "$*" >>"${sleepLog}"\n`,
    );

    const result = runScript({
      PATH: `${binDir}:${process.env.PATH}`,
      SYMPHONY_FSTAB_PATH: fstabPath,
      SYMPHONY_WORKSPACE_DEVICE_WAIT_INTERVAL_SECONDS: "1",
      SYMPHONY_WORKSPACE_DEVICE_WAIT_TIMEOUT_SECONDS: "2",
      SYMPHONY_WORKSPACE_LABEL: "MISSINGWS",
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_ROOT: workspaceRoot,
    });

    assert.notEqual(result.status, 0);
    assert.equal(await readFile(sleepLog, "utf8"), "sleep 1\nsleep 1\n");
    assert.match(
      result.stderr,
      /LABEL=MISSINGWS was not found after waiting 2s/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("fails non-root initialization when the requested owner differs", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "symphony-owner-"));

  try {
    const result = runScript({
      SYMPHONY_WORKSPACE_GROUP: currentGroup,
      SYMPHONY_WORKSPACE_LOG_LINK: join(tempRoot, "var", "log", "symphony"),
      SYMPHONY_WORKSPACE_MANAGE_FSTAB: "0",
      SYMPHONY_WORKSPACE_ROOT: join(tempRoot, "var", "lib", "symphony"),
      SYMPHONY_WORKSPACE_SKIP_MOUNT: "1",
      SYMPHONY_WORKSPACE_USER: "not-current-symphony-user",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /run as root to assign/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
