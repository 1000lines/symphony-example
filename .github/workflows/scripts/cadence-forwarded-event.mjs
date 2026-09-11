import { appendFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourcePath = ".github/workflows/cadence-review-ingress.yml";
const actions = {
  pull_request_target: ["opened", "ready_for_review", "synchronize"],
  issue_comment: ["created", "edited"],
  pull_request_review: ["submitted", "edited"],
  pull_request_review_comment: ["created", "edited"],
};
const requireEvidence = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function sourceEvent(run, repository) {
  requireEvidence(run?.repository?.full_name === repository && run.path === sourcePath &&
    run.name === "Cadence Review Ingress" && run.status === "completed" && run.conclusion === "success",
  "Invalid Cadence ingress run");
  const match = run.display_title?.match(/^cadence-event\/v1 (\w+) (\w+) ([1-9]\d*) (\d+) (-|[a-f0-9]{40})$/);
  requireEvidence(match, "Missing Cadence event selectors");
  const [, eventName, action, number, feedbackId, headSha] = match;
  requireEvidence(eventName === run.event && actions[eventName]?.includes(action) &&
    Number.isSafeInteger(Number(number)) && Number.isSafeInteger(Number(feedbackId)) &&
    (eventName === "pull_request_target" ? feedbackId === "0" : Number(feedbackId) > 0) &&
    (eventName === "issue_comment" ? headSha === "-" : headSha !== "-"), "Invalid Cadence event selectors");
  requireEvidence(run.actor?.id && run.actor?.login && run.actor?.type, "Missing ingress actor");
  return { eventName, action, number: Number(number), feedbackId: Number(feedbackId), headSha };
}

// This job runs from the default branch with actions:write and a main checkout. It never reads
// PR code, event bodies, artifacts, signing material, provider or Linear tokens.
export async function forwardCadenceEvent({ github, context }) {
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const run = (await github.rest.actions.getWorkflowRun({ ...context.repo,
    run_id: context.payload.workflow_run.id })).data;
  const event = sourceEvent(run, repository);
  const workflows = ["cadence-ai-review-events.yml"];
  if (["issue_comment", "pull_request_review"].includes(event.eventName)) workflows.push("cadence-linear-rework.yml");
  for (const workflow_id of workflows) {
    await github.rest.actions.createWorkflowDispatch({ ...context.repo, workflow_id, ref: "main",
      inputs: { source_run_id: String(run.id), pr_number: String(event.number) } });
  }
  return workflows;
}

// Run titles and dispatch inputs are routing hints, including for fork runs
// whose PR list is empty. Neither identifies an authorized feedback author.
// Retain the existing permission checks in both consumers after reconstruction.
export async function resolveCadenceEvent({ repository, sourceRunId, prNumber, read }) {
  requireEvidence(/^[\w.-]+\/[\w.-]+$/.test(repository) && /^[1-9]\d*$/.test(sourceRunId), "Invalid source run request");
  const root = `/repos/${repository}`;
  const run = await read(`${root}/actions/runs/${sourceRunId}`);
  requireEvidence(String(run.id) === sourceRunId, "Source run mismatch");
  const event = sourceEvent(run, repository);
  requireEvidence(String(event.number) === prNumber, "Source PR mismatch");
  const pr = await read(`${root}/pulls/${event.number}`);
  requireEvidence(pr.number === event.number && pr.base?.repo?.full_name === repository && pr.head?.sha,
    "Current PR identity is unavailable");
  requireEvidence(pr.state === "open", "Closed PR event");
  requireEvidence(event.headSha === "-" || event.headSha === pr.head.sha, "Stale event head");
  const payload = { action: event.action, repository: run.repository, pull_request: pr, sender: run.actor };
  if (event.eventName !== "pull_request_target") {
    const isReview = event.eventName === "pull_request_review";
    const isComment = event.eventName === "issue_comment";
    const feedback = await read(isReview ? `${root}/pulls/${pr.number}/reviews/${event.feedbackId}` :
      `${root}/${isComment ? "issues" : "pulls"}/comments/${event.feedbackId}`);
    const parent = isComment ? feedback.issue_url : feedback.pull_request_url;
    requireEvidence(feedback.id === event.feedbackId && feedback.user?.id && feedback.user?.login &&
      parent === `https://api.github.com${root}/${isComment ? "issues" : "pulls"}/${pr.number}`,
    "Current feedback identity is unavailable");
    requireEvidence(!isReview || (feedback.submitted_at && feedback.commit_id === pr.head.sha), "Stale or unsubmitted review");
    requireEvidence(event.eventName !== "pull_request_review_comment" || feedback.commit_id === pr.head.sha, "Stale inline comment");
    payload[isReview ? "review" : "comment"] = feedback;
    if (isComment) payload.issue = { ...pr, pull_request: { url: pr.url } };
  }
  return { payload, eventName: event.eventName };
}

async function main() {
  requireEvidence(process.env.GITHUB_REF === "refs/heads/main" && process.env.GITHUB_EVENT_NAME === "workflow_dispatch",
    "Forwarded events require a dispatch on main");
  const resolved = await resolveCadenceEvent({ repository: process.env.GITHUB_REPOSITORY,
    sourceRunId: process.env.SOURCE_RUN_ID, prNumber: process.env.PR_NUMBER,
    read: async path => {
      const response = await fetch(`https://api.github.com${path}`, { redirect: "error",
        headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(20000) });
      requireEvidence(response.ok, `Forwarded event read failed: HTTP ${response.status}`);
      return response.json();
    } });
  const path = `${process.env.RUNNER_TEMP}/cadence-event.json`;
  writeFileSync(path, JSON.stringify(resolved.payload));
  appendFileSync(process.env.GITHUB_ENV, `CADENCE_EVENT_PATH=${path}\nCADENCE_EVENT_NAME=${resolved.eventName}\n`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Forwarded review event\n\nSource: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.SOURCE_RUN_ID}\n\nController ref: ${process.env.GITHUB_REF}; PR: ${resolved.payload.pull_request.number}; head: ${resolved.payload.pull_request.head.sha}. Original author permission is checked by the consumer before action.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
