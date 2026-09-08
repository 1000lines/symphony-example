import {
  CommandIo,
  HostCommandRequest,
  HostCommandResult,
  HostLogResult,
  HostStatus,
  runCommand,
  selectSingle,
  SymphonyHostAws,
  SymphonyHostTarget,
  WorkstreamResult,
} from "./commands";

const baseTarget: SymphonyHostTarget = {
  accountId: "123456789012",
  region: "us-west-2",
  instance: {
    id: "i-123",
    state: "running",
    tags: {
      "symphony:bootstrap-ref": "main",
      "symphony:runtime-ref": "main",
      "symphony:worker-slots": "6",
    },
  },
  alb: {
    arn: "arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/symphony/abc",
    dnsName: "symphony-123.us-west-2.elb.amazonaws.com",
  },
  targetGroup: {
    arn: "arn:aws:elasticloadbalancing:us-west-2:123456789012:targetgroup/symphony/abc",
  },
  volume: {
    id: "vol-123",
    state: "in-use",
  },
};

class FixtureAws implements SymphonyHostAws {
  readonly events: string[];

  constructor(
    private readonly targets: readonly SymphonyHostTarget[],
    events: string[],
    private readonly hostCommandResult?: HostCommandResult
  ) {
    this.events = events;
  }

  async discoverTarget(): Promise<SymphonyHostTarget> {
    this.events.push("aws:discoverTarget");
    return selectSingle(
      "Symphony Host target",
      this.targets,
      (target) => target.instance.id
    );
  }

  async getStatus(): Promise<HostStatus> {
    this.events.push("aws:getStatus");
    return {
      instanceStatus: "ok",
      systemStatus: "ok",
      ssmConnectionStatus: "connected",
      serviceState: "active",
      targetHealth: ["i-123:healthy"],
      refs: { bootstrap: "main", runtime: "main" },
      workerSlots: "6",
      latestProvenance: "sha=abc123",
    };
  }

  async getLogs(): Promise<HostLogResult> {
    this.events.push("aws:getLogs");
    return {
      events: [
        {
          source: "service",
          timestamp: "2026-08-07T00:00:00.000Z",
          message: "symphony service healthy",
        },
      ],
    };
  }

  async updateInstanceTags(): Promise<void> {
    this.events.push("aws:updateInstanceTags");
  }

  async startInstance(): Promise<void> {
    this.events.push("aws:startInstance");
  }

  async stopInstance(): Promise<void> {
    this.events.push("aws:stopInstance");
  }

  async rebootInstance(): Promise<void> {
    this.events.push("aws:rebootInstance");
  }

  async sendHostCommand(
    _target: SymphonyHostTarget,
    request: HostCommandRequest
  ): Promise<HostCommandResult> {
    this.events.push("aws:sendHostCommand");
    this.events.push(`wait:${String(request.waitForCompletion ?? false)}`);
    this.events.push(
      ...request.commands.map((command) => `command:${command}`)
    );
    return (
      this.hostCommandResult ??
      (request.waitForCompletion
        ? {
            commandId: "cmd-123",
            status: "Success",
            output: [
              "Reconciliation provenance:",
              '{"refs":{"bootstrap":{"resolved_sha":"abc"},"runtime":{"resolved_sha":"def"}}}',
              "Runtime bundle freshness: installed bundle matches current source",
              "Symphony HTTP readiness: ok",
            ].join("\n"),
          }
        : { commandId: "cmd-123", status: "Pending" })
    );
  }

  async inspectWorkstreams(): Promise<WorkstreamResult> {
    this.events.push("aws:inspectWorkstreams");
    return {
      summary: "DEMO-424 branch=symphony/sample-host/DEMO-424/management-cli",
    };
  }

  async startSsmShell(): Promise<void> {
    this.events.push("aws:startSsmShell");
  }
}

function capture(
  events: string[]
): CommandIo & { stdoutLines: string[]; stderrLines: string[] } {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  return {
    stdoutLines,
    stderrLines,
    stdout: (line) => {
      events.push(`stdout:${line}`);
      stdoutLines.push(line);
    },
    stderr: (line) => {
      events.push(`stderr:${line}`);
      stderrLines.push(line);
    },
  };
}

test("fails closed on ambiguous target selection", async () => {
  const events: string[] = [];
  const io = capture(events);
  const aws = new FixtureAws(
    [
      baseTarget,
      {
        ...baseTarget,
        instance: { ...baseTarget.instance, id: "i-456" },
      },
    ],
    events
  );

  const exitCode = await runCommand(["status"], { aws, io });

  expect(exitCode).toBe(1);
  expect(io.stderrLines.join("\n")).toContain(
    "Ambiguous Symphony Host target selection"
  );
});

test("prints full target identity before mutating start command", async () => {
  const events: string[] = [];
  const io = capture(events);
  const aws = new FixtureAws([baseTarget], events);

  const exitCode = await runCommand(["start", "--yes"], { aws, io });

  expect(exitCode).toBe(0);
  expect(io.stdoutLines.join("\n")).toContain("account: 123456789012");
  expect(io.stdoutLines.join("\n")).toContain("region: us-west-2");
  expect(io.stdoutLines.join("\n")).toContain("instance: i-123 (running)");
  expect(io.stdoutLines.join("\n")).toContain(
    "ALB: arn:aws:elasticloadbalancing"
  );
  expect(io.stdoutLines.join("\n")).toContain("volume: vol-123 (in-use)");
  expect(events.indexOf("stdout:  volume: vol-123 (in-use)")).toBeLessThan(
    events.indexOf("aws:startInstance")
  );
});

test("status and logs use read-only AWS paths", async () => {
  const events: string[] = [];
  const io = capture(events);
  const aws = new FixtureAws([baseTarget], events);

  expect(await runCommand(["status"], { aws, io })).toBe(0);
  expect(await runCommand(["logs"], { aws, io })).toBe(0);

  expect(events).toEqual(
    expect.arrayContaining([
      "aws:discoverTarget",
      "aws:getStatus",
      "aws:getLogs",
    ])
  );
  expect(events).not.toContain("aws:updateInstanceTags");
  expect(events).not.toContain("aws:startInstance");
  expect(events).not.toContain("aws:stopInstance");
  expect(events).not.toContain("aws:rebootInstance");
  expect(events).not.toContain("aws:sendHostCommand");
});

test("reconcile restarts the persistent oneshot unit and waits for readiness", async () => {
  const events: string[] = [];
  const io = capture(events);
  const aws = new FixtureAws([baseTarget], events);

  expect(await runCommand(["reconcile", "--yes"], { aws, io })).toBe(0);

  expect(events).toContain("wait:true");
  expect(events).toContain(
    "command:sudo systemctl restart symphony-reconcile.service"
  );
  expect(events).toContain(
    "command:sudo test -s /var/lib/symphony-bootstrap/provenance.json"
  );
  expect(events).toContain(
    "command:sudo /opt/symphony/bootstrap/reconcile.sh --check-runtime-bundle-fresh"
  );
  expect(events).toContain(
    "command:for attempt in $(seq 1 60); do if curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:4000; then echo 'Symphony HTTP readiness: ok'; symphony_http_ready=1; break; fi; sleep 5; done"
  );
  expect(events).not.toContain(
    "command:sudo systemctl start symphony-reconcile.service"
  );
  expect(io.stdoutLines.join("\n")).toContain("SSM status: Success");
  expect(io.stdoutLines.join("\n")).toContain("Reconciliation provenance:");
  expect(io.stdoutLines.join("\n")).toContain(
    "Runtime bundle freshness: installed bundle matches current source"
  );
  expect(io.stdoutLines.join("\n")).toContain("Symphony HTTP readiness: ok");
});

test("reconcile does not report completion when the waited SSM command fails", async () => {
  const events: string[] = [];
  const io = capture(events);
  const aws = new FixtureAws([baseTarget], events, {
    commandId: "cmd-123",
    status: "Failed",
    output: "reconcile failed",
  });

  expect(await runCommand(["reconcile", "--yes"], { aws, io })).toBe(1);

  expect(io.stdoutLines.join("\n")).toContain("SSM command id: cmd-123");
  expect(io.stdoutLines.join("\n")).toContain("SSM status: Failed");
  expect(io.stdoutLines.join("\n")).toContain("reconcile failed");
  expect(io.stdoutLines.join("\n")).not.toContain(
    "Completed: run Symphony reconciliation"
  );
  expect(io.stderrLines.join("\n")).toContain(
    "Symphony reconciliation SSM command did not finish successfully"
  );
});
