export const DEFAULT_REGION = "us-west-2";
export const DEFAULT_TARGET_NAME = "symphony";

export type TargetSelection = {
  readonly region?: string;
  readonly profile?: string;
  readonly name: string;
  readonly environment?: string;
  readonly instanceId?: string;
  readonly albArn?: string;
  readonly targetGroupArn?: string;
  readonly volumeId?: string;
};

export type TargetInstance = {
  readonly id: string;
  readonly state?: string;
  readonly privateIp?: string;
  readonly tags: Readonly<Record<string, string>>;
};

export type TargetLoadBalancer = {
  readonly arn: string;
  readonly name?: string;
  readonly dnsName?: string;
  readonly state?: string;
};

export type TargetGroup = {
  readonly arn: string;
  readonly name?: string;
};

export type TargetVolume = {
  readonly id: string;
  readonly state?: string;
  readonly device?: string;
  readonly sizeGiB?: number;
};

export type SymphonyHostTarget = {
  readonly accountId: string;
  readonly region: string;
  readonly profile?: string;
  readonly instance: TargetInstance;
  readonly alb: TargetLoadBalancer;
  readonly targetGroup: TargetGroup;
  readonly volume: TargetVolume;
};

export type HostStatus = {
  readonly instanceStatus?: string;
  readonly systemStatus?: string;
  readonly ssmConnectionStatus?: string;
  readonly serviceState?: string;
  readonly targetHealth: readonly string[];
  readonly refs: {
    readonly bootstrap?: string;
    readonly runtime?: string;
  };
  readonly workerSlots?: string;
  readonly latestProvenance?: string;
};

export type HostLogRequest = {
  readonly sources: readonly string[];
  readonly lines: number;
  readonly sinceMinutes?: number;
};

export type HostLogEvent = {
  readonly source: string;
  readonly timestamp?: string;
  readonly message: string;
};

export type HostLogResult = {
  readonly events: readonly HostLogEvent[];
};

export type HostCommandRequest = {
  readonly comment: string;
  readonly commands: readonly string[];
  readonly timeoutSeconds?: number;
  readonly waitForCompletion?: boolean;
};

export type HostCommandResult = {
  readonly commandId?: string;
  readonly status?: string;
  readonly output?: string;
};

export type WorkstreamResult = {
  readonly summary: string;
  readonly commandId?: string;
};

export interface SymphonyHostAws {
  discoverTarget(selection: TargetSelection): Promise<SymphonyHostTarget>;
  getStatus(target: SymphonyHostTarget): Promise<HostStatus>;
  getLogs(
    target: SymphonyHostTarget,
    request: HostLogRequest
  ): Promise<HostLogResult>;
  updateInstanceTags(
    target: SymphonyHostTarget,
    tags: Readonly<Record<string, string>>
  ): Promise<void>;
  startInstance(target: SymphonyHostTarget): Promise<void>;
  stopInstance(target: SymphonyHostTarget): Promise<void>;
  rebootInstance(target: SymphonyHostTarget): Promise<void>;
  sendHostCommand(
    target: SymphonyHostTarget,
    request: HostCommandRequest
  ): Promise<HostCommandResult>;
  inspectWorkstreams(target: SymphonyHostTarget): Promise<WorkstreamResult>;
  startSsmShell(target: SymphonyHostTarget): Promise<void>;
}

export type CommandIo = {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

export type CommandDependencies = {
  readonly aws: SymphonyHostAws;
  readonly io?: CommandIo;
};

export class CommandError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
    this.name = "CommandError";
  }
}

export class TargetDiscoveryError extends CommandError {
  constructor(message: string) {
    super(message, 1);
    this.name = "TargetDiscoveryError";
  }
}

export function selectSingle<T>(
  kind: string,
  candidates: readonly T[],
  describe: (candidate: T) => string
): T {
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length === 0) {
    throw new TargetDiscoveryError(
      `No ${kind} matched the explicit discovery criteria.`
    );
  }

  throw new TargetDiscoveryError(
    `Ambiguous ${kind} selection: ${candidates
      .map(describe)
      .join(", ")}. Pass an explicit selector before running the command.`
  );
}

type ParsedArgv = {
  readonly positionals: readonly string[];
  readonly options: Readonly<
    Record<string, string | boolean | readonly string[]>
  >;
};

const BOOLEAN_OPTIONS = new Set([
  "dry-run",
  "help",
  "json",
  "reconcile",
  "yes",
]);

const COMMANDS = [
  "status",
  "set-ref",
  "set-slots",
  "start",
  "stop",
  "reboot",
  "restart-service",
  "reconcile",
  "logs",
  "workstreams",
  "ssm-shell",
  "rollback",
  "standup",
] as const;

const consoleIo: CommandIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

export async function runCommand(
  argv: readonly string[],
  dependencies: CommandDependencies
): Promise<number> {
  const io = dependencies.io ?? consoleIo;

  try {
    await runCommandOrThrow(parseArgv(argv), dependencies.aws, io);
    return 0;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return error instanceof CommandError ? error.exitCode : 1;
  }
}

async function runCommandOrThrow(
  parsed: ParsedArgv,
  aws: SymphonyHostAws,
  io: CommandIo
): Promise<void> {
  const [command, ...args] = parsed.positionals;
  if (!command || readBoolean(parsed.options, "help")) {
    printUsage(io);
    return;
  }

  if (!COMMANDS.includes(command as (typeof COMMANDS)[number])) {
    throw new CommandError(`Unknown command: ${command}`);
  }

  const selection = readTargetSelection(parsed.options);

  switch (command) {
    case "status":
      assertNoExtraArgs(command, args);
      await runStatus(aws, io, selection);
      return;
    case "set-ref":
      await runSetRef(aws, io, selection, parsed, args);
      return;
    case "set-slots":
      await runSetSlots(aws, io, selection, parsed, args);
      return;
    case "start":
      assertNoExtraArgs(command, args);
      await runGuardedMutation(
        aws,
        io,
        selection,
        parsed,
        "start instance",
        (target) => aws.startInstance(target)
      );
      return;
    case "stop":
      assertNoExtraArgs(command, args);
      await runGuardedMutation(
        aws,
        io,
        selection,
        parsed,
        "stop instance",
        (target) => aws.stopInstance(target)
      );
      return;
    case "reboot":
      assertNoExtraArgs(command, args);
      await runGuardedMutation(
        aws,
        io,
        selection,
        parsed,
        "reboot instance",
        (target) => aws.rebootInstance(target)
      );
      return;
    case "restart-service":
      assertNoExtraArgs(command, args);
      await runGuardedMutation(
        aws,
        io,
        selection,
        parsed,
        "restart symphony.service",
        (target) =>
          aws
            .sendHostCommand(target, {
              comment: "Restart symphony.service",
              commands: [
                "sudo systemctl restart symphony.service",
                "systemctl --no-pager --full status symphony.service || true",
              ],
              timeoutSeconds: 300,
            })
            .then(printCommandResult(io))
      );
      return;
    case "reconcile":
      assertNoExtraArgs(command, args);
      await runGuardedMutation(
        aws,
        io,
        selection,
        parsed,
        "run Symphony reconciliation",
        (target) => runReconcile(aws, io, target)
      );
      return;
    case "logs":
      assertNoExtraArgs(command, args);
      await runLogs(aws, io, selection, parsed.options);
      return;
    case "workstreams":
      assertNoExtraArgs(command, args);
      await runWorkstreams(aws, io, selection);
      return;
    case "ssm-shell":
      assertNoExtraArgs(command, args);
      await runGuardedMutation(
        aws,
        io,
        selection,
        parsed,
        "open SSM shell",
        (target) => aws.startSsmShell(target)
      );
      return;
    case "rollback":
      await runRollback(aws, io, selection, parsed, args);
      return;
    case "standup":
      assertNoExtraArgs(command, args);
      await runStandup(aws, io, selection);
      return;
  }
}

async function runStatus(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection
): Promise<void> {
  const target = await discoverAndPrintTarget(aws, io, selection);
  const status = await aws.getStatus(target);
  io.stdout("Status:");
  io.stdout(`  instance status: ${status.instanceStatus ?? "unknown"}`);
  io.stdout(`  system status: ${status.systemStatus ?? "unknown"}`);
  io.stdout(`  ssm: ${status.ssmConnectionStatus ?? "unknown"}`);
  io.stdout(`  service: ${status.serviceState ?? "unknown"}`);
  io.stdout(`  bootstrap ref: ${status.refs.bootstrap ?? "unknown"}`);
  io.stdout(`  runtime ref: ${status.refs.runtime ?? "unknown"}`);
  io.stdout(`  worker slots: ${status.workerSlots ?? "unknown"}`);
  io.stdout(
    `  target health: ${
      status.targetHealth.length > 0
        ? status.targetHealth.join(", ")
        : "unknown"
    }`
  );
  io.stdout(`  latest provenance: ${status.latestProvenance ?? "unknown"}`);
}

async function runSetRef(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection,
  parsed: ParsedArgv,
  args: readonly string[]
): Promise<void> {
  if (args.length !== 2) {
    throw new CommandError(
      "Usage: set-ref <bootstrap|runtime> <ref> [--reconcile] [--yes]"
    );
  }

  const tagName = refKindToTag(args[0]);
  const ref = validateRef(args[1]);
  await runGuardedMutation(
    aws,
    io,
    selection,
    parsed,
    `set ${tagName}=${ref}`,
    async (target) => {
      await aws.updateInstanceTags(target, { [tagName]: ref });
      if (readBoolean(parsed.options, "reconcile")) {
        await runReconcile(aws, io, target);
      }
    }
  );
}

async function runSetSlots(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection,
  parsed: ParsedArgv,
  args: readonly string[]
): Promise<void> {
  if (args.length > 1) {
    throw new CommandError("Usage: set-slots [count] [--yes]");
  }

  const count =
    args[0] === undefined ? 6 : parsePositiveInt(args[0], "worker slot count");
  await runGuardedMutation(
    aws,
    io,
    selection,
    parsed,
    `set symphony:worker-slots=${count}`,
    (target) =>
      aws.updateInstanceTags(target, {
        "symphony:worker-slots": String(count),
      })
  );
}

async function runLogs(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection,
  options: ParsedArgv["options"]
): Promise<void> {
  const target = await discoverAndPrintTarget(aws, io, selection);
  const logs = await aws.getLogs(target, {
    sources: readStringList(options, "source"),
    lines: parsePositiveInt(
      readStringOption(options, "lines") ?? "80",
      "line count"
    ),
    sinceMinutes: readStringOption(options, "since-minutes")
      ? parsePositiveInt(
          readStringOption(options, "since-minutes") ?? "0",
          "since minutes"
        )
      : undefined,
  });

  io.stdout("Logs:");
  if (logs.events.length === 0) {
    io.stdout("  no log events returned");
    return;
  }

  for (const event of logs.events) {
    const timestamp = event.timestamp ? `${event.timestamp} ` : "";
    io.stdout(`  [${event.source}] ${timestamp}${event.message}`);
  }
}

async function runWorkstreams(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection
): Promise<void> {
  const target = await discoverAndPrintTarget(aws, io, selection);
  const result = await aws.inspectWorkstreams(target);
  io.stdout("Workstreams:");
  io.stdout(`  ${result.summary}`);
  if (result.commandId) {
    io.stdout(`  command id: ${result.commandId}`);
  }
}

async function runRollback(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection,
  parsed: ParsedArgv,
  args: readonly string[]
): Promise<void> {
  if (args.length !== 1) {
    throw new CommandError("Usage: rollback <sha/ref> [--yes]");
  }

  const ref = validateRef(args[0]);
  await runGuardedMutation(
    aws,
    io,
    selection,
    parsed,
    `rollback runtime ref to ${ref}`,
    async (target) => {
      const previous =
        target.instance.tags["symphony:runtime-ref"] ?? "unknown";
      io.stdout(`Previous runtime ref: ${previous}`);
      await aws.updateInstanceTags(target, {
        "symphony:runtime-ref": ref,
      });
      await runReconcile(aws, io, target);
    }
  );
}

async function runStandup(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection
): Promise<void> {
  const target = await discoverAndPrintTarget(aws, io, selection);
  const [status, logs, workstreams] = await Promise.all([
    aws.getStatus(target),
    aws.getLogs(target, { sources: [], lines: 20 }),
    aws.inspectWorkstreams(target),
  ]);

  io.stdout("Standup:");
  io.stdout(
    `  host: instance=${target.instance.state ?? "unknown"} ssm=${
      status.ssmConnectionStatus ?? "unknown"
    } target-health=${
      status.targetHealth.length > 0
        ? status.targetHealth.join(", ")
        : "unknown"
    }`
  );
  io.stdout(
    `  refs: bootstrap=${status.refs.bootstrap ?? "unknown"} runtime=${
      status.refs.runtime ?? "unknown"
    } slots=${status.workerSlots ?? "unknown"}`
  );
  io.stdout(`  workstreams: ${workstreams.summary}`);
  io.stdout(`  recent logs: ${logs.events.length}`);
  io.stdout(
    "  Linear/GitHub: derived from active workspaces and PR links when present."
  );
}

async function runReconcile(
  aws: SymphonyHostAws,
  io: CommandIo,
  target: SymphonyHostTarget
): Promise<void> {
  const result = await aws.sendHostCommand(target, {
    comment: "Run Symphony host reconciliation",
    commands: [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'trap \'status=$?; if [ "$status" -ne 0 ]; then systemctl --no-pager --full status symphony.service || true; sudo journalctl -u symphony-reconcile.service -n 120 --no-pager || true; fi; exit "$status"\' EXIT',
      "sudo systemctl restart symphony-reconcile.service",
      "echo 'Reconciliation result: symphony-reconcile.service restarted'",
      "sudo test -s /var/lib/symphony-bootstrap/provenance.json",
      "echo 'Reconciliation provenance:'",
      "sudo cat /var/lib/symphony-bootstrap/provenance.json",
      "sudo /opt/symphony/bootstrap/reconcile.sh --check-runtime-bundle-fresh",
      "echo 'Runtime bundle freshness: installed bundle matches current source'",
      "systemctl is-active --quiet symphony.service",
      "echo 'Symphony service readiness: symphony.service active'",
      "echo 'Waiting for Symphony HTTP readiness on 127.0.0.1:4000'",
      "symphony_http_ready=0",
      "for attempt in $(seq 1 60); do if curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:4000; then echo 'Symphony HTTP readiness: ok'; symphony_http_ready=1; break; fi; sleep 5; done",
      "systemctl --no-pager --full status symphony.service || true",
      "sudo journalctl -u symphony-reconcile.service -n 120 --no-pager || true",
      "if [ \"$symphony_http_ready\" -ne 1 ]; then echo 'Symphony HTTP readiness: failed after 300s' >&2; exit 1; fi",
    ],
    timeoutSeconds: 900,
    waitForCompletion: true,
  });
  printCommandResult(io)(result);
  assertSuccessfulHostCommand(result, "Symphony reconciliation");
}

async function runGuardedMutation(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection,
  parsed: ParsedArgv,
  description: string,
  mutate: (target: SymphonyHostTarget) => Promise<void>
): Promise<void> {
  const target = await discoverAndPrintTarget(aws, io, selection);

  if (readBoolean(parsed.options, "dry-run")) {
    io.stdout(`Dry run: would ${description}.`);
    return;
  }

  if (!readBoolean(parsed.options, "yes")) {
    throw new CommandError(
      `Refusing to ${description} without --yes after target review.`
    );
  }

  await mutate(target);
  io.stdout(`Completed: ${description}`);
}

async function discoverAndPrintTarget(
  aws: SymphonyHostAws,
  io: CommandIo,
  selection: TargetSelection
): Promise<SymphonyHostTarget> {
  const target = await aws.discoverTarget(selection);
  printTarget(io, target);
  return target;
}

function printTarget(io: CommandIo, target: SymphonyHostTarget): void {
  io.stdout("Target:");
  io.stdout(`  account: ${target.accountId}`);
  io.stdout(`  region: ${target.region}`);
  io.stdout(
    `  instance: ${target.instance.id}${formatOptionalState(
      target.instance.state
    )}`
  );
  io.stdout(
    `  ALB: ${target.alb.arn}${
      target.alb.dnsName ? ` (${target.alb.dnsName})` : ""
    }`
  );
  io.stdout(
    `  volume: ${target.volume.id}${formatOptionalState(target.volume.state)}`
  );
}

function printCommandResult(
  io: CommandIo
): (result: HostCommandResult) => void {
  return (result) => {
    if (result.commandId) {
      io.stdout(`SSM command id: ${result.commandId}`);
    }
    if (result.status) {
      io.stdout(`SSM status: ${result.status}`);
    }
    if (result.output) {
      io.stdout(result.output);
    }
  };
}

function assertSuccessfulHostCommand(
  result: HostCommandResult,
  description: string
): void {
  if (normalizeCommandStatus(result.status) === "Success") {
    return;
  }

  throw new CommandError(
    `${description} SSM command did not finish successfully (status: ${
      result.status ?? "unknown"
    }).`
  );
}

function normalizeCommandStatus(status: string | undefined): string {
  return status?.replace(/\s+/g, "") ?? "";
}

function printUsage(io: CommandIo): void {
  io.stdout("Usage: symphony-host <command> [args] [options]");
  io.stdout("");
  io.stdout("Commands:");
  for (const command of COMMANDS) {
    io.stdout(`  ${command}`);
  }
  io.stdout("");
  io.stdout("Global target options:");
  io.stdout("  --region <region> --profile <profile> --name <tag-name>");
  io.stdout(
    "  --instance-id <id> --alb-arn <arn> --target-group-arn <arn> --volume-id <id>"
  );
  io.stdout("  --yes is required before mutating commands execute.");
}

function parseArgv(argv: readonly string[]): ParsedArgv {
  const positionals: string[] = [];
  const options: Record<string, string | boolean | readonly string[]> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const raw = token.slice(2);
    const equalsIndex = raw.indexOf("=");
    const name = equalsIndex === -1 ? raw : raw.slice(0, equalsIndex);
    const inlineValue =
      equalsIndex === -1 ? undefined : raw.slice(equalsIndex + 1);

    if (BOOLEAN_OPTIONS.has(name)) {
      options[name] =
        inlineValue === undefined ? true : inlineValue !== "false";
      continue;
    }

    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CommandError(`Missing value for --${name}`);
    }
    if (inlineValue === undefined) {
      index += 1;
    }
    appendOption(options, name, value);
  }

  return { positionals, options };
}

function appendOption(
  options: Record<string, string | boolean | readonly string[]>,
  name: string,
  value: string
): void {
  const existing = options[name];
  if (existing === undefined) {
    options[name] = value;
    return;
  }
  if (Array.isArray(existing)) {
    options[name] = [...existing, value];
    return;
  }
  if (typeof existing === "string") {
    options[name] = [existing, value];
    return;
  }
  throw new CommandError(`--${name} does not take a value`);
}

function readTargetSelection(options: ParsedArgv["options"]): TargetSelection {
  return {
    region: readStringOption(options, "region"),
    profile: readStringOption(options, "profile"),
    name: readStringOption(options, "name") ?? DEFAULT_TARGET_NAME,
    environment:
      readStringOption(options, "environment") ??
      readStringOption(options, "env"),
    instanceId: readStringOption(options, "instance-id"),
    albArn: readStringOption(options, "alb-arn"),
    targetGroupArn: readStringOption(options, "target-group-arn"),
    volumeId: readStringOption(options, "volume-id"),
  };
}

function readBoolean(options: ParsedArgv["options"], name: string): boolean {
  return options[name] === true;
}

function readStringOption(
  options: ParsedArgv["options"],
  name: string
): string | undefined {
  const value = options[name];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  throw new CommandError(`--${name} expects a value`);
}

function readStringList(
  options: ParsedArgv["options"],
  name: string
): readonly string[] {
  const value = options[name];
  if (value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value;
  }
  throw new CommandError(`--${name} expects a value`);
}

function refKindToTag(
  kind: string
): "symphony:bootstrap-ref" | "symphony:runtime-ref" {
  if (kind === "bootstrap" || kind === "bootstrap-ref") {
    return "symphony:bootstrap-ref";
  }
  if (kind === "runtime" || kind === "runtime-ref") {
    return "symphony:runtime-ref";
  }
  throw new CommandError("Ref kind must be bootstrap or runtime.");
}

function validateRef(ref: string): string {
  if (!/^[A-Za-z0-9._/:@-]+$/.test(ref)) {
    throw new CommandError(
      "Ref must be a non-empty git ref or SHA without whitespace."
    );
  }
  return ref;
}

function parsePositiveInt(value: string, label: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new CommandError(`${label} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CommandError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function assertNoExtraArgs(command: string, args: readonly string[]): void {
  if (args.length > 0) {
    throw new CommandError(
      `Unexpected arguments for ${command}: ${args.join(" ")}`
    );
  }
}

function formatOptionalState(state: string | undefined): string {
  return state ? ` (${state})` : "";
}
