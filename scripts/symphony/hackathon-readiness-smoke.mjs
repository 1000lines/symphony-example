#!/usr/bin/env node
// Read-only deployment observations. This does not decide CI/review acceptance,
// mutate tickets, dispatch reviews, install credentials, or implement a controller.
import yaml from "js-yaml";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { inspectConfig } from "./runtime-bundle/skills/symphony-repository/scripts/config.mjs";

const observations = [];
class SmokeError extends Error {}
function requireThat(condition, message) {
  if (!condition) throw new SmokeError(message);
}
function api(endpoint, paginated = false) {
  let output;
  try {
    output = execFileSync(
      "gh",
      [
        "api",
        "--method",
        "GET",
        endpoint,
        ...(paginated ? ["--paginate", "--slurp"] : []),
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
        maxBuffer: 8 * 1024 * 1024,
      }
    );
  } catch (error) {
    // Never echo command output, environment values, or response bodies.
    const status = String(error.stderr || "").match(/HTTP (\d{3})/)?.[1];
    throw new SmokeError(
      `GET ${endpoint} failed${status ? `: HTTP ${status}` : " or timed out"}`
    );
  }
  try {
    return JSON.parse(output);
  } catch {
    throw new SmokeError(`GET ${endpoint} returned invalid JSON`);
  }
}
function observe(name, read) {
  try {
    observations.push({ name, result: "pass", evidence: read() });
  } catch (error) {
    observations.push({
      name,
      result: "blocked",
      reason:
        error instanceof SmokeError
          ? error.message
          : "Cannot read valid observation data; raw output withheld",
    });
  }
}

try {
  const { values } = parseArgs({
    options: {
      repo: { type: "string", default: "1000lines/symphony-example" },
      base: { type: "string", default: "main" },
      pr: { type: "string" },
      "host-workflow": { type: "string", default: "/etc/symphony/WORKFLOW.md" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    process.stdout.write(
      "Usage: hackathon-readiness-smoke.mjs [--repo OWNER/REPO] [--base BRANCH] [--pr NUMBER] [--host-workflow FILE]\nRead-only preflight; run from the target checkout after fetching its selected base. Exit 1 means a blocked observation, not a completed rehearsal.\n"
    );
    process.exit(0);
  }
  requireThat(
    /^[\w.-]+\/[\w.-]+$/.test(values.repo) &&
      !values.repo.split("/").some((part) => [".", ".."].includes(part)),
    "Invalid repository"
  );
  requireThat(!values.pr || /^[1-9]\d*$/.test(values.pr), "Invalid PR number");
  const repository = `repos/${values.repo}`;
  observe("selected-base configuration (R06)", () => {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const url = new URL(
      remote.replace(/^git@github\.com:/, "https://github.com/")
    );
    requireThat(
      url.hostname === "github.com" &&
        url.pathname
          .replace(/^\//, "")
          .replace(/\.git$/, "")
          .toLowerCase() === values.repo.toLowerCase(),
      "Checkout origin does not match --repo"
    );
    const selected = inspectConfig(process.cwd(), values.base);
    requireThat(
      selected.status === "configured" &&
        selected.config.ci.requiredChecks.length > 0,
      "Selected base needs nonempty required CI configuration"
    );
    return {
      revision: selected.revision,
      team: selected.config.linear.teamKey,
      requiredChecks: selected.config.ci.requiredChecks,
    };
  });
  observe("workflow enablement (R08)", () => {
    const required = [
      "ci.yml",
      "cadence-review-ingress.yml",
      "cadence-ai-review-events.yml",
      "cadence-ai-review-trigger.yml",
      "symphony-linear-wakeups.yml",
    ];
    const workflows = api(
      `${repository}/actions/workflows?per_page=100`,
      true
    ).flatMap((page) => page.workflows);
    const selected = required.map((file) => {
      const workflow = workflows.find(
        (row) => row.path === `.github/workflows/${file}`
      );
      requireThat(
        workflow?.state === "active",
        `${file} is missing or not active`
      );
      return { id: workflow.id, path: workflow.path, state: workflow.state };
    });
    return selected;
  });
  observe("protected review Environment (R04)", () => {
    const environment = `${repository}/environments/cadence-controller`;
    const policy = api(environment).deployment_branch_policy;
    const branches = api(
      `${environment}/deployment-branch-policies?per_page=100`,
      true
    ).flatMap((page) => page.branch_policies);
    requireThat(
      policy?.custom_branch_policies === true &&
        policy.protected_branches === false &&
        branches.length === 1 &&
        branches[0].name === values.base &&
        branches[0].type === "branch",
      "Review Environment must select only the protected base branch"
    );
    requireThat(
      api(`${repository}/branches/${encodeURIComponent(values.base)}`)
        .protected === true,
      "Selected base is not protected"
    );
    return {
      policy,
      branches: branches.map(({ id, name, type }) => ({ id, name, type })),
    };
  });
  observe("review App secret metadata (R04)", () => {
    const secrets = api(
      `${repository}/environments/cadence-controller/secrets?per_page=100`,
      true
    ).flatMap((page) => page.secrets);
    const key = secrets.find((row) => row.name === "CADENCE_APP_PRIVATE_KEY");
    requireThat(
      key,
      "Review Environment does not list CADENCE_APP_PRIVATE_KEY"
    );
    return {
      name: key.name,
      updatedAt: key.updated_at,
      limitation:
        "Presence does not prove key delivery to the reusable reviewer or successful authentication.",
    };
  });
  observe("installed timer profile (R09)", () => {
    const source = readFileSync(values["host-workflow"], "utf8");
    const profile = yaml.load(
      source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || ""
    );
    const tracker = profile?.tracker;
    requireThat(
      tracker?.active_states?.includes("Active") &&
        tracker.active_states.includes("Evaluating") &&
        tracker.daemon_states?.length === 1 &&
        tracker.daemon_states[0] === "Unhappy" &&
        tracker.daemon_dispatch_states?.length === 1 &&
        tracker.daemon_dispatch_states[0] === "Evaluating" &&
        tracker.daemon_default_wake === "15m" &&
        profile.agent?.max_concurrent_agents_by_state?.Evaluating === 1,
      "Installed workflow lacks the accepted per-ticket Unhappy/15m/Evaluating profile"
    );
    return {
      path: values["host-workflow"],
      limitation:
        "File inspection does not prove service reload, an engine anchor, dispatch, or released worker slot.",
    };
  });
  if (values.pr)
    observe("PR evidence snapshot (R05/R06)", () => {
      const endpoint = `${repository}/pulls/${values.pr}`;
      const pr = api(endpoint);
      requireThat(
        pr.state === "open" &&
          pr.head?.repo?.full_name === values.repo &&
          pr.base?.ref === values.base,
        "PR must be open in the selected repository and target the selected base"
      );
      const sha = pr.head.sha;
      requireThat(/^[a-f0-9]{40}$/.test(sha), "PR head is missing or invalid");
      const checks = api(
        `${repository}/commits/${sha}/check-runs?per_page=100`,
        true
      ).flatMap((page) => page.check_runs);
      const runs = api(
        `${repository}/actions/runs?head_sha=${sha}&per_page=100`,
        true
      ).flatMap((page) => page.workflow_runs);
      const reviews = api(`${endpoint}/reviews?per_page=100`, true).flat();
      const current = api(endpoint);
      requireThat(
        current.state === "open" &&
          current.head?.sha === sha &&
          current.base?.sha === pr.base.sha,
        "PR changed during collection; discard the snapshot and rerun"
      );
      return {
        url: pr.html_url,
        head: sha,
        base: pr.base.sha,
        draft: pr.draft,
        checks: checks.map((row) => ({
          id: row.id,
          name: row.name,
          head: row.head_sha,
          appId: row.app?.id,
          status: row.status,
          conclusion: row.conclusion,
          url: row.details_url,
        })),
        runs: runs.map((row) => ({
          id: row.id,
          attempt: row.run_attempt,
          head: row.head_sha,
          workflow: row.path,
          event: row.event,
          status: row.status,
          conclusion: row.conclusion,
          url: row.html_url,
        })),
        reviews: reviews.map((row) => ({
          id: row.id,
          author: row.user?.login,
          head: row.commit_id,
          state: row.state,
          submittedAt: row.submitted_at,
          url: row.html_url,
        })),
        limitation:
          "Snapshot only: inspect run jobs/checkout summaries, all feedback surfaces and the Linear workpad before acceptance. Missing or stale evidence is not success.",
      };
    });
  process.stdout.write(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        repository: values.repo,
        base: values.base,
        scope: "read-only deployment preflight",
        readiness: "not assessed",
        observations,
      },
      null,
      2
    ) + "\n"
  );
  if (observations.some((row) => row.result !== "pass")) process.exitCode = 1;
} catch (error) {
  console.error(
    error instanceof SmokeError
      ? error.message
      : "Invalid command or unreadable source; use --help. Raw output withheld."
  );
  process.exitCode = 1;
}
