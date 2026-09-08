import { spawn } from "child_process";

import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  CreateTagsCommand,
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand,
  DescribeVolumesCommand,
  EC2Client,
  RebootInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  type DescribeInstancesCommandInput,
  type Filter,
  type Instance,
  type Tag,
} from "@aws-sdk/client-ec2";
import {
  DescribeLoadBalancersCommand,
  DescribeTagsCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
  type LoadBalancer,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  GetCommandInvocationCommand,
  GetConnectionStatusCommand,
  SendCommandCommand,
  SSMClient,
  type GetCommandInvocationCommandOutput,
} from "@aws-sdk/client-ssm";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { fromIni } from "@aws-sdk/credential-providers";

import {
  DEFAULT_REGION,
  DEFAULT_TARGET_NAME,
  HostCommandRequest,
  HostCommandResult,
  HostLogEvent,
  HostLogRequest,
  HostLogResult,
  HostStatus,
  selectSingle,
  SymphonyHostAws,
  SymphonyHostTarget,
  TargetDiscoveryError,
  TargetSelection,
  WorkstreamResult,
} from "./commands";

type AwsSelection = {
  readonly region?: string;
  readonly profile?: string;
};

type AwsClientConfig = {
  readonly region: string;
  readonly credentials?: ReturnType<typeof fromIni>;
};

const DEFAULT_LOG_GROUPS: Readonly<Record<string, string>> = {
  "cloud-init": "/symphony/host/cloud-init",
  reconcile: "/symphony/host/reconcile",
  service: "/symphony/host/service",
};

const HOST_COMMAND_POLL_INTERVAL_MS = 5_000;
const TERMINAL_HOST_COMMAND_STATUSES = new Set([
  "Cancelled",
  "DeliveryTimedOut",
  "ExecutionTimedOut",
  "Failed",
  "InvalidPlatform",
  "Success",
  "Terminated",
  "TimedOut",
  "Undeliverable",
]);

export class AwsSdkSymphonyHostAws implements SymphonyHostAws {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async discoverTarget(
    selection: TargetSelection
  ): Promise<SymphonyHostTarget> {
    const region = this.region(selection);
    const accountId = await this.accountId(selection);
    const ec2 = this.ec2(selection);
    const instance = await this.discoverInstance(ec2, selection);
    const alb = await this.discoverLoadBalancer(selection);
    const targetGroup = await this.discoverTargetGroup(selection, alb.arn);
    const volume = await this.discoverVolume(ec2, selection, instance.id);

    return {
      accountId,
      region,
      profile: selection.profile,
      instance,
      alb,
      targetGroup,
      volume,
    };
  }

  async getStatus(target: SymphonyHostTarget): Promise<HostStatus> {
    const ec2 = this.ec2(target);
    const ssm = this.ssm(target);
    const elb = this.elb(target);

    const instanceStatus = await ec2
      .send(
        new DescribeInstanceStatusCommand({
          IncludeAllInstances: true,
          InstanceIds: [target.instance.id],
        })
      )
      .then((response) => response.InstanceStatuses?.[0])
      .catch(() => undefined);

    const ssmConnectionStatus = await ssm
      .send(new GetConnectionStatusCommand({ Target: target.instance.id }))
      .then((response) => response.Status)
      .catch((error) => `unavailable: ${formatAwsError(error)}`);

    const health = await elb
      .send(
        new DescribeTargetHealthCommand({
          TargetGroupArn: target.targetGroup.arn,
          Targets: [{ Id: target.instance.id }],
        })
      )
      .then(
        (response) =>
          response.TargetHealthDescriptions?.map((description) => {
            const id = description.Target?.Id ?? target.instance.id;
            const state = description.TargetHealth?.State ?? "unknown";
            const reason = description.TargetHealth?.Reason;
            return reason ? `${id}:${state}:${reason}` : `${id}:${state}`;
          }) ?? []
      )
      .catch((error) => [`unavailable:${formatAwsError(error)}`]);

    return {
      instanceStatus: instanceStatus?.InstanceStatus?.Status,
      systemStatus: instanceStatus?.SystemStatus?.Status,
      ssmConnectionStatus,
      serviceState: "unknown (not queried by read-only status)",
      targetHealth: health,
      refs: {
        bootstrap: target.instance.tags["symphony:bootstrap-ref"],
        runtime: target.instance.tags["symphony:runtime-ref"],
      },
      workerSlots: target.instance.tags["symphony:worker-slots"],
      latestProvenance: "unavailable from AWS metadata",
    };
  }

  async getLogs(
    target: SymphonyHostTarget,
    request: HostLogRequest
  ): Promise<HostLogResult> {
    const logs = this.logs(target);
    const sources =
      request.sources.length > 0
        ? request.sources
        : Object.keys(DEFAULT_LOG_GROUPS);
    const startTime = request.sinceMinutes
      ? Date.now() - request.sinceMinutes * 60_000
      : undefined;
    const events: HostLogEvent[] = [];

    for (const source of sources) {
      const logGroupName = DEFAULT_LOG_GROUPS[source] ?? source;
      try {
        const response = await logs.send(
          new FilterLogEventsCommand({
            logGroupName,
            limit: request.lines,
            startTime,
          })
        );
        for (const event of response.events ?? []) {
          events.push({
            source,
            timestamp: event.timestamp
              ? new Date(event.timestamp).toISOString()
              : undefined,
            message: redactLogMessage(event.message ?? ""),
          });
        }
      } catch (error) {
        events.push({
          source,
          message: `unavailable: ${formatAwsError(error)}`,
        });
      }
    }

    return { events };
  }

  async updateInstanceTags(
    target: SymphonyHostTarget,
    tags: Readonly<Record<string, string>>
  ): Promise<void> {
    await this.ec2(target).send(
      new CreateTagsCommand({
        Resources: [target.instance.id],
        Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
      })
    );
  }

  async startInstance(target: SymphonyHostTarget): Promise<void> {
    await this.ec2(target).send(
      new StartInstancesCommand({ InstanceIds: [target.instance.id] })
    );
  }

  async stopInstance(target: SymphonyHostTarget): Promise<void> {
    await this.ec2(target).send(
      new StopInstancesCommand({ InstanceIds: [target.instance.id] })
    );
  }

  async rebootInstance(target: SymphonyHostTarget): Promise<void> {
    await this.ec2(target).send(
      new RebootInstancesCommand({ InstanceIds: [target.instance.id] })
    );
  }

  async sendHostCommand(
    target: SymphonyHostTarget,
    request: HostCommandRequest
  ): Promise<HostCommandResult> {
    const ssm = this.ssm(target);
    const response = await ssm.send(
      new SendCommandCommand({
        Comment: request.comment,
        DocumentName: "AWS-RunShellScript",
        InstanceIds: [target.instance.id],
        Parameters: {
          commands: [...request.commands],
          executionTimeout: [String(request.timeoutSeconds ?? 600)],
        },
      })
    );

    const commandId = response.Command?.CommandId;
    if (!request.waitForCompletion) {
      return {
        commandId,
        status: response.Command?.Status,
      };
    }

    if (!commandId) {
      throw new Error("SSM SendCommand did not return a command id.");
    }

    return waitForHostCommand(
      ssm,
      target.instance.id,
      commandId,
      request.timeoutSeconds ?? 600
    );
  }

  async inspectWorkstreams(
    target: SymphonyHostTarget
  ): Promise<WorkstreamResult> {
    const result = await this.sendHostCommand(target, {
      comment: "Inspect Symphony workstreams",
      commands: [WORKSTREAM_SCRIPT],
      timeoutSeconds: 300,
    });
    return {
      summary: "submitted read-only workspace inspection on the Symphony host",
      commandId: result.commandId,
    };
  }

  async startSsmShell(target: SymphonyHostTarget): Promise<void> {
    await runAwsCli(
      [
        "ssm",
        "start-session",
        "--target",
        target.instance.id,
        "--region",
        target.region,
      ],
      target.profile
    );
  }

  private async accountId(selection: AwsSelection): Promise<string> {
    const response = await this.sts(selection).send(
      new GetCallerIdentityCommand({})
    );
    return required(response.Account, "AWS account id");
  }

  private async discoverInstance(
    ec2: EC2Client,
    selection: TargetSelection
  ): Promise<SymphonyHostTarget["instance"]> {
    const input: DescribeInstancesCommandInput = selection.instanceId
      ? { InstanceIds: [selection.instanceId] }
      : {
          Filters: compactFilters([
            {
              Name: "tag:Name",
              Values: [selection.name || DEFAULT_TARGET_NAME],
            },
            selection.environment
              ? { Name: "tag:env", Values: [selection.environment] }
              : undefined,
            {
              Name: "instance-state-name",
              Values: ["pending", "running", "stopping", "stopped"],
            },
          ]),
        };
    const instances: Instance[] = [];
    let nextToken: string | undefined;
    do {
      const response = await ec2.send(
        new DescribeInstancesCommand({ ...input, NextToken: nextToken })
      );
      instances.push(...flattenInstances(response.Reservations ?? []));
      nextToken = response.NextToken;
    } while (nextToken);

    const selected = selectSingle(
      "Symphony Host instance",
      instances,
      (candidate) => candidate.InstanceId ?? "unknown-instance"
    );

    return {
      id: required(selected.InstanceId, "EC2 instance id"),
      state: selected.State?.Name,
      privateIp: selected.PrivateIpAddress,
      tags: tagMap(selected.Tags),
    };
  }

  private async discoverLoadBalancer(
    selection: TargetSelection
  ): Promise<SymphonyHostTarget["alb"]> {
    const elb = this.elb(selection);
    const loadBalancers: LoadBalancer[] = [];
    let marker: string | undefined;
    do {
      const response = await elb.send(
        new DescribeLoadBalancersCommand(
          selection.albArn
            ? { LoadBalancerArns: [selection.albArn] }
            : { Marker: marker }
        )
      );
      loadBalancers.push(...(response.LoadBalancers ?? []));
      marker = selection.albArn ? undefined : response.NextMarker;
    } while (marker);

    const tagged = await this.withElbTags(elb, loadBalancers);
    const candidates = selection.albArn
      ? tagged
      : tagged.filter(({ loadBalancer, tags }) => {
          const expectedName = selection.name || DEFAULT_TARGET_NAME;
          const nameMatches =
            loadBalancer.LoadBalancerName === expectedName ||
            tags.Name === expectedName;
          const envMatches = selection.environment
            ? tags.env === selection.environment
            : true;
          return nameMatches && envMatches;
        });
    const selected = selectSingle(
      "Symphony Host ALB",
      candidates,
      ({ loadBalancer }) =>
        loadBalancer.LoadBalancerArn ??
        loadBalancer.LoadBalancerName ??
        "unknown-load-balancer"
    );

    return {
      arn: required(selected.loadBalancer.LoadBalancerArn, "ALB arn"),
      name: selected.loadBalancer.LoadBalancerName,
      dnsName: selected.loadBalancer.DNSName,
      state: selected.loadBalancer.State?.Code,
    };
  }

  private async discoverTargetGroup(
    selection: TargetSelection,
    albArn: string
  ): Promise<SymphonyHostTarget["targetGroup"]> {
    const elb = this.elb(selection);
    const response = await elb.send(
      new DescribeTargetGroupsCommand(
        selection.targetGroupArn
          ? { TargetGroupArns: [selection.targetGroupArn] }
          : { LoadBalancerArn: albArn }
      )
    );
    const selected = selectSingle(
      "Symphony Host target group",
      response.TargetGroups ?? [],
      (candidate) =>
        candidate.TargetGroupArn ??
        candidate.TargetGroupName ??
        "unknown-target-group"
    );

    return {
      arn: required(selected.TargetGroupArn, "target group arn"),
      name: selected.TargetGroupName,
    };
  }

  private async discoverVolume(
    ec2: EC2Client,
    selection: TargetSelection,
    instanceId: string
  ): Promise<SymphonyHostTarget["volume"]> {
    const response = await ec2.send(
      new DescribeVolumesCommand(
        selection.volumeId
          ? { VolumeIds: [selection.volumeId] }
          : {
              Filters: [
                { Name: "attachment.instance-id", Values: [instanceId] },
                {
                  Name: "tag:Name",
                  Values: [selection.name || DEFAULT_TARGET_NAME],
                },
              ],
            }
      )
    );
    const selected = selectSingle(
      "Symphony Host workspace volume",
      response.Volumes ?? [],
      (candidate) => candidate.VolumeId ?? "unknown-volume"
    );
    const attachment = selected.Attachments?.find(
      (candidate) => candidate.InstanceId === instanceId
    );

    return {
      id: required(selected.VolumeId, "EBS volume id"),
      state: selected.State,
      device: attachment?.Device,
      sizeGiB: selected.Size,
    };
  }

  private async withElbTags(
    elb: ElasticLoadBalancingV2Client,
    loadBalancers: readonly LoadBalancer[]
  ): Promise<
    readonly {
      readonly loadBalancer: LoadBalancer;
      readonly tags: Readonly<Record<string, string>>;
    }[]
  > {
    const byArn = new Map<string, Readonly<Record<string, string>>>();
    const arns = loadBalancers
      .map((loadBalancer) => loadBalancer.LoadBalancerArn)
      .filter((arn): arn is string => Boolean(arn));

    for (const batch of chunk(arns, 20)) {
      const response = await elb.send(
        new DescribeTagsCommand({ ResourceArns: batch })
      );
      for (const description of response.TagDescriptions ?? []) {
        if (description.ResourceArn) {
          byArn.set(description.ResourceArn, tagMap(description.Tags));
        }
      }
    }

    return loadBalancers.map((loadBalancer) => ({
      loadBalancer,
      tags: loadBalancer.LoadBalancerArn
        ? byArn.get(loadBalancer.LoadBalancerArn) ?? {}
        : {},
    }));
  }

  private ec2(selection: AwsSelection): EC2Client {
    return new EC2Client(this.awsClientConfig(selection));
  }

  private elb(selection: AwsSelection): ElasticLoadBalancingV2Client {
    return new ElasticLoadBalancingV2Client(this.awsClientConfig(selection));
  }

  private logs(selection: AwsSelection): CloudWatchLogsClient {
    return new CloudWatchLogsClient(this.awsClientConfig(selection));
  }

  private ssm(selection: AwsSelection): SSMClient {
    return new SSMClient(this.awsClientConfig(selection));
  }

  private sts(selection: AwsSelection): STSClient {
    return new STSClient(this.awsClientConfig(selection));
  }

  private awsClientConfig(selection: AwsSelection): AwsClientConfig {
    const profile = selection.profile ?? this.env.AWS_PROFILE;
    return {
      region: this.region(selection),
      ...(profile ? { credentials: fromIni({ profile }) } : {}),
    };
  }

  private region(selection: AwsSelection): string {
    return (
      selection.region ??
      this.env.AWS_REGION ??
      this.env.AWS_DEFAULT_REGION ??
      DEFAULT_REGION
    );
  }
}

function flattenInstances(
  reservations: readonly { readonly Instances?: readonly Instance[] }[]
): Instance[] {
  return reservations.flatMap((reservation) => [
    ...(reservation.Instances ?? []),
  ]);
}

function tagMap(
  tags: readonly Tag[] | undefined
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const tag of tags ?? []) {
    if (tag.Key && tag.Value) {
      result[tag.Key] = tag.Value;
    }
  }
  return result;
}

function compactFilters(filters: readonly (Filter | undefined)[]): Filter[] {
  return filters.filter((filter): filter is Filter => Boolean(filter));
}

function required(value: string | undefined, label: string): string {
  if (!value) {
    throw new TargetDiscoveryError(`AWS response did not include ${label}.`);
  }
  return value;
}

function chunk<T>(values: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function formatAwsError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function redactLogMessage(message: string): string {
  return message
    .replace(
      /(token|secret|password|private_key|api[_-]?key)(["'\s:=]+)([^"'\s]+)/gi,
      "$1$2[REDACTED]"
    )
    .replace(
      /(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)=\S+/g,
      "$1=[REDACTED]"
    );
}

async function waitForHostCommand(
  ssm: SSMClient,
  instanceId: string,
  commandId: string,
  timeoutSeconds: number
): Promise<HostCommandResult> {
  const deadline = Date.now() + (timeoutSeconds + 60) * 1000;
  let lastStatus = "Pending";

  for (;;) {
    const invocation = await ssm
      .send(
        new GetCommandInvocationCommand({
          CommandId: commandId,
          InstanceId: instanceId,
        })
      )
      .catch((error) => {
        if (isPendingInvocation(error)) {
          return undefined;
        }
        throw error;
      });

    if (invocation) {
      lastStatus =
        invocation.StatusDetails ?? invocation.Status ?? "unknown status";

      if (isSuccessfulHostCommandStatus(invocation)) {
        return {
          commandId,
          status: "Success",
          output: formatCommandOutput(invocation),
        };
      }

      if (isTerminalHostCommandStatus(invocation)) {
        return {
          commandId,
          status: formatCommandStatus(invocation),
          output: formatCommandOutput(invocation),
        };
      }
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      return {
        commandId,
        status: `Timed out waiting; last status ${lastStatus}`,
      };
    }

    await sleep(Math.min(HOST_COMMAND_POLL_INTERVAL_MS, remainingMs));
  }
}

function isPendingInvocation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "InvocationDoesNotExist" ||
      error.name === "InvocationDoesNotExistException")
  );
}

function isTerminalHostCommandStatus(
  invocation: GetCommandInvocationCommandOutput
): boolean {
  return [invocation.Status, invocation.StatusDetails].some(
    (status) =>
      status !== undefined &&
      TERMINAL_HOST_COMMAND_STATUSES.has(normalizeCommandStatus(status))
  );
}

function normalizeCommandStatus(status: string | undefined): string {
  return status?.replace(/\s+/g, "") ?? "";
}

function isSuccessfulHostCommandStatus(
  invocation: GetCommandInvocationCommandOutput
): boolean {
  return [invocation.Status, invocation.StatusDetails].some(
    (status) => normalizeCommandStatus(status) === "Success"
  );
}

function formatCommandStatus(
  invocation: GetCommandInvocationCommandOutput
): string {
  const parts = [invocation.Status, invocation.StatusDetails].filter(
    (status, index, values): status is string =>
      typeof status === "string" && values.indexOf(status) === index
  );
  const responseCode =
    invocation.ResponseCode === undefined
      ? ""
      : `; response code ${invocation.ResponseCode}`;
  return `${parts.join(" / ")}${responseCode}`;
}

function formatCommandOutput(
  invocation: GetCommandInvocationCommandOutput
): string | undefined {
  const stdout = invocation.StandardOutputContent?.trimEnd();
  const stderr = invocation.StandardErrorContent?.trimEnd();
  const parts = [stdout, stderr ? `stderr:\n${stderr}` : undefined].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runAwsCli(
  args: readonly string[],
  profile: string | undefined
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "aws",
      profile ? [...args, "--profile", profile] : [...args],
      {
        stdio: "inherit",
      }
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`aws ${args.join(" ")} exited with code ${code ?? "unknown"}`)
      );
    });
  });
}

const WORKSTREAM_SCRIPT = String.raw`set -euo pipefail
root=/var/lib/symphony/workspaces
if [ ! -d "$root" ]; then
  echo "workspace root not found: $root"
  exit 0
fi
find "$root" -mindepth 1 -maxdepth 1 -type d -print0 |
  xargs -0 -I{} sh -c '
    path="$1"
    size=$(du -sh "$path" 2>/dev/null | awk "{print \$1}")
    branch=$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
    remote=$(git -C "$path" config --get remote.origin.url 2>/dev/null || true)
    printf "%s size=%s branch=%s remote=%s\n" "$(basename "$path")" "\${size:-unknown}" "\${branch:-unknown}" "\${remote:-unknown}"
  ' sh {}`;
