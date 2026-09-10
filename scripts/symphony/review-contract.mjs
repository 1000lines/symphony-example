// Shared, side-effect-free acceptance policy. API records must be acquired by
// trusted base code, never supplied by the PR or an assessment process.
import { createHash } from "node:crypto";
import { classifyGitHubActor } from "../github-actor-classification.mjs";

export const CADENCE_APP_ID = 4866513;
export const CADENCE_CHECK_NAME = "Cadence Review";
export const REVIEW_SCHEMA = "cadence-review/v1";
export const FEEDBACK_SOURCES = ["reviews", "comments", "threads", "linearComments"];
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
const canonical = (value) => JSON.stringify(value, (_, entry) =>
  entry && !Array.isArray(entry) && typeof entry === "object"
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
export const reviewDigest = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const same = (a, b) => canonical(a) === canonical(b);
const fail = (reason) => ({ passes: false, reason });

// The mapping uses the JSON subset of YAML so standalone hosted/Actions helpers
// need no npm install. Revision comes from the protected branch, not file text.
export async function loadRepositoryMapping({ controller, expectedRevision, token, fetchImpl = fetch }) {
  assert(/^[\w.-]+\/[\w.-]+$/.test(controller), "Invalid controller");
  assert(sha(expectedRevision), "Missing expected configuration revision");
  const read = async path => {
    const response = await fetchImpl(`https://api.github.com/repos/${controller}/${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    assert(response.ok, `Mapping read failed: HTTP ${response.status}`);
    return response.json();
  };
  const branch = await read("branches/main");
  assert(branch.protected === true && branch.commit?.sha === expectedRevision,
    "Configuration must match protected controller main");
  const file = await read(`contents/.github/symphony/repositories.yml?ref=${expectedRevision}`);
  assert(file.encoding === "base64" && nonempty(file.content), "Missing mapping content");
  const mapping = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  assert(mapping.schema === "symphony-repositories/v1" && mapping.controller === controller,
    "Invalid mapping schema/controller");
  return { mapping, revision: expectedRevision };
}

const validCi = (ci) => Array.isArray(ci?.required_checks) && ci.required_checks.length > 0 &&
  new Set(ci.required_checks.map(c => c?.name)).size === ci.required_checks.length &&
  ci.required_checks.every(c => c && nonempty(c.name) && positive(c.app_id) &&
    /^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(c.workflow_path) && c.tested_ref === "head" &&
    positive(c.running_timeout_minutes) && Array.isArray(c.events) && c.events.length > 0 &&
    c.events.every(e => ["push", "pull_request", "workflow_dispatch"].includes(e)) &&
    ["pr-head", "default-branch"].includes(c.ref_policy) &&
    Array.isArray(c.children) && c.children.every(child => child && nonempty(child.name) && positive(child.running_timeout_minutes))) &&
  ["missing_after_minutes", "queued_after_minutes", "completion_grace_minutes", "run_budget_minutes"]
    .every(key => positive(ci[key]));

// request is identification only. All authority comes from mapping and live API
// evidence; no installation, permission, workflow or project overrides accepted.
export function resolveTarget({ mapping, revision, hostRevision, controllerRevision, request,
  repository, controllerRepository = repository, pullRequest, issue, associations, installations }) {
  assert(mapping?.schema === "symphony-repositories/v1" && sha(revision) &&
    revision === hostRevision && revision === controllerRevision, "Configuration revision mismatch");
  assert(request && Object.keys(request).every(k => ["repositoryId", "prNumber", "headSha"].includes(k)),
    "Caller authority override");
  assert(positive(request.repositoryId) && positive(request.prNumber) && sha(request.headSha), "Invalid target identity");
  const entries = mapping.repositories?.filter(t => t.repository_id === request.repositoryId);
  assert(entries?.length === 1 && entries[0].enabled === true, "Unknown, duplicate or disabled target");
  const target = entries[0];
  assert(repository?.id === target.repository_id && repository.full_name === target.full_name &&
    repository.owner?.login === target.full_name.split("/")[0], "Repository owner/name mismatch");
  assert(pullRequest?.number === request.prNumber && pullRequest.state === "open" &&
    pullRequest.head?.sha === request.headSha && pullRequest.base?.repo?.id === repository.id,
    "PR closed or target/head mismatch");
  assert(nonempty(target.linear?.team_id) && nonempty(target.linear?.project_id) &&
    nonempty(issue?.id) && issue.team?.id === target.linear?.team_id &&
    issue.project?.id === target.linear?.project_id && Array.isArray(associations) &&
    associations.length === 1 && associations[0] === issue.id, "Ambiguous or wrong Linear association");
  assert(nonempty(target.human?.github) && nonempty(target.human?.linear_id) &&
    Array.isArray(target.labels) && target.labels.length > 0 &&
    target.labels.every(label => pullRequest.labels?.some(l => l.name === label)), "Missing identity/labels");
  const controllers = mapping.repositories.filter(entry => entry.full_name === mapping.controller);
  assert(controllers.length === 1 && controllers[0].enabled && positive(controllers[0].repository_id) &&
    controllerRepository.id === controllers[0].repository_id && controllerRepository.full_name === mapping.controller &&
    controllerRepository.owner?.login === mapping.controller.split("/")[0], "Invalid controller identity");
  for (const entry of new Set([target, controllers[0]])) {
    const owner = entry.full_name.split("/")[0];
    assert(entry.apps?.cadence?.app_id === CADENCE_APP_ID && positive(entry.apps?.symphony?.app_id) &&
      entry.apps.symphony.app_id !== CADENCE_APP_ID, "Invalid App identity");
    for (const role of ["symphony", "cadence"]) {
      const configured = entry.apps[role];
      const matches = installations?.filter(i => i.id === configured.installation_id);
      const installation = matches?.length === 1 ? matches[0] : null;
      assert(positive(configured.installation_id) && installation?.app_id === configured.app_id &&
        installation.account?.login === owner && installation.suspended_at === null &&
        installation.repository_ids?.includes(entry.repository_id), `Invalid ${role} installation selection`);
      assert(!mapping.repositories.some(other => other.full_name.split("/")[0] !== owner &&
        Object.values(other.apps || {}).some(app => app.installation_id === configured.installation_id)),
        "Installation reused across owners");
    }
  }
  assert(target.dispatch?.repository === mapping.controller && target.dispatch.ref === "refs/heads/main" &&
    /^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(target.dispatch.workflow), "Invalid dispatch authority");
  assert(validCi(target.ci) && positive(target.review?.timeout_minutes) &&
    target.review.max_passes === 3 && target.review.operational_retries === 1, "Incomplete gate configuration");
  assert(nonempty(pullRequest.head.ref) && sha(pullRequest.base.sha) && nonempty(repository.default_branch),
    "Missing target refs");
  return { ...structuredClone(target), controller: structuredClone(controllers[0]), configRevision: revision, issueId: issue.id,
    prNumber: request.prNumber, headSha: request.headSha, headRef: pullRequest.head.ref,
    defaultBranch: repository.default_branch, baseSha: pullRequest.base.sha };
}

// runs: REST Actions runs (latest run_attempt), jobs: attempt-specific REST jobs,
// checks: REST check runs. tested_sha/ref are acquisition evidence from the
// explicit checkout, not the workflow's synthetic merge/default SHA.
export function evaluateCi({ target, runs = [], jobs = [], checks = [], complete = false } = {}) {
  if (!target?.enabled || !sha(target.headSha) || !validCi(target.ci) || !complete)
    return fail("missing-ci-configuration-or-history");
  const evidence = [];
  for (const rule of target.ci.required_checks) {
    const candidates = runs.filter(run => run.repository?.id === target.repository_id &&
      run.head_sha === target.headSha && run.path === rule.workflow_path && rule.events.includes(run.event) &&
      run.head_branch === (rule.ref_policy === "pr-head" ? target.headRef : target.defaultBranch));
    if (!candidates.length) return fail(`missing-run:${rule.name}`);
    if (candidates.some(r => !positive(r.id) || !positive(r.run_number) || !positive(r.run_attempt)))
      return fail(`invalid-run:${rule.name}`);
    // Across allowed events, a later run supersedes earlier evidence, even before
    // its jobs/checks appear. Reruns supersede the earlier attempt of the same run.
    candidates.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt);
    const run = candidates[0];
    if (candidates.filter(r => r.run_number === run.run_number && r.run_attempt === run.run_attempt).length !== 1)
      return fail(`ambiguous-run:${rule.name}`);
    if (run.status !== "completed" || run.conclusion !== "success") return fail(`run-${run.conclusion || run.status}:${rule.name}`);
    const selected = [];
    for (const name of [rule.name, ...rule.children.map(c => c.name)]) {
      const matches = jobs.filter(job => job.run_id === run.id && job.run_attempt === run.run_attempt && job.name === name);
      if (matches.length !== 1) return fail(`missing-or-ambiguous-job:${name}`);
      const job = matches[0];
      const ownedChecks = checks.filter(check => check.name === name && check.app?.id === rule.app_id &&
        check.check_suite?.id === run.check_suite_id && check.head_sha === target.headSha &&
        check.url === job.check_run_url);
      if (!positive(job.id) || !positive(run.check_suite_id) || !positive(ownedChecks[0]?.id) ||
        job.head_sha !== target.headSha || job.tested_sha !== target.headSha ||
        ownedChecks.length !== 1 || job.status !== "completed" || job.conclusion !== "success" ||
        ownedChecks[0].status !== "completed" || ownedChecks[0].conclusion !== "success")
        return fail(`invalid-job-provenance-or-result:${name}`);
      selected.push({ jobId: job.id, checkId: ownedChecks[0].id, name });
    }
    evidence.push({ name: rule.name, runId: run.id, attempt: run.run_attempt, jobs: selected });
  }
  return { passes: true, reason: "current-ci-success", evidence };
}

export const isGeneratedBookkeeping = (body) =>
  ["## Codex Workpad", "## Cadence Workpad", "## Symphony Workpad"].includes(
    String(body || "").split(/\r?\n/).find(line => line.trim() !== "") || "");

// Every human record is retained, not just the newest timestamp. Edits, removed
// comments and thread resolution changes all change this deterministic watermark.
export function feedbackWatermark(sources, { isHuman = actor => actor?.type !== "Bot" && actor?.__typename !== "Bot" &&
  nonempty(actor?.login || actor?.name) && (!actor?.login || classifyGitHubActor(actor.login).humanFacing) } = {}) {
  let complete = true;
  const records = [];
  for (const source of FEEDBACK_SOURCES) {
    const collection = sources?.[source];
    if (collection?.complete !== true || !Array.isArray(collection?.nodes)) { complete = false; continue; }
    for (const node of collection.nodes) {
      if (isGeneratedBookkeeping(node.body) || node.state === "PENDING") continue;
      const actor = node.author || node.user;
      if (!actor) { complete = false; continue; }
      if (!isHuman(actor)) continue;
      const updatedAt = node.updatedAt || node.updated_at || node.submittedAt;
      if (!node.id || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) { complete = false; continue; }
      records.push({ source, id: String(node.id), updatedAt, digest: reviewDigest({
        body: node.body || "", state: node.state || "", threadId: node.threadId || "",
        isResolved: node.isResolved ?? null, isOutdated: node.isOutdated ?? null,
      }) });
    }
  }
  records.sort((a, b) => `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`));
  if (new Set(records.map(r => `${r.source}:${r.id}`)).size !== records.length) complete = false;
  return { complete, records, digest: reviewDigest(records) };
}

export function createReviewGeneration({ repositoryId, prNumber, headSha, baseSha, configRevision,
  feedback, manualRetry = 0 }) {
  assert(positive(repositoryId) && positive(prNumber) && sha(headSha) && sha(baseSha) && sha(configRevision) &&
    feedback && typeof feedback.complete === "boolean" && Array.isArray(feedback.records) && feedback.digest === reviewDigest(feedback.records) &&
    Number.isSafeInteger(manualRetry) && manualRetry >= 0, "Invalid review generation");
  const context = { repositoryId, prNumber, headSha, baseSha, configRevision, feedback, manualRetry };
  return { ...context, id: reviewDigest(context), resetKey: reviewDigest({ feedback: feedback.digest, manualRetry }) };
}

export function queueReviewGeneration(current, generation, { checkId, operationalRetry = false } = {}) {
  assert(positive(checkId) && generation?.id === createReviewGeneration(generation).id, "Invalid queued review");
  if (current?.generation.id === generation.id && !operationalRetry) return current;
  const reset = !current || (generation.feedback.complete && current.generation.resetKey !== generation.resetKey);
  const passes = reset ? 0 : current.passes;
  const sameGeneration = current?.generation.id === generation.id;
  const retries = sameGeneration ? current.operationalRetries : 0;
  assert(!operationalRetry || (sameGeneration && ["operational-error", "cancelled", "timed_out"].includes(current.phase) && retries < 1),
    "Operational retry unavailable");
  assert(operationalRetry || passes < 3, "Three-pass review cap requires human input");
  return { generation, sequence: (current?.sequence || 0) + 1, attempt: sameGeneration ? current.attempt + 1 : 1,
    checkId, phase: "queued", passes: passes + (operationalRetry ? 0 : 1),
    ledger: structuredClone(current?.ledger || { requirements: [], findings: [], humanFeedback: [] }),
    operationalRetries: retries + (operationalRetry ? 1 : 0) };
}

export function startReviewGeneration(current, liveGeneration) {
  assert(current?.phase === "queued" && current.generation.id === liveGeneration?.id, "Superseded review start");
  return { ...current, phase: "in_progress" };
}

export function validateReviewOutput(output, generation) {
  if (!output || output.schema !== REVIEW_SCHEMA || output.repositoryId !== generation.repositoryId ||
    output.prNumber !== generation.prNumber || output.headSha !== generation.headSha ||
    output.generationId !== generation.id || output.sourcesComplete !== true || !nonempty(output.summary)) return false;
  return ["requirements", "findings", "humanFeedback"].every(key => Array.isArray(output[key]) &&
    output[key].every(x => x && nonempty(x.id) && nonempty(x.summary) && nonempty(x.status)) &&
    new Set(output[key].map(x => `${x.source || ""}:${x.id}`)).size === output[key].length) && output.requirements.length > 0 &&
    output.requirements.every(r => ["satisfied", "unsatisfied", "human-needed"].includes(r.status) && Array.isArray(r.evidence)) &&
    output.humanFeedback.every(f => ["addressed", "deferred", "blocked"].includes(f.status) && typeof f.mandatory === "boolean") &&
    generation.feedback.records.every(record => output.humanFeedback.some(f =>
      f.id === record.id && f.source === record.source && f.updatedAt === record.updatedAt)) &&
    output.findings.every(f => ["blocker", "human-needed", "should-fix", "suggestion"].includes(f.class) &&
      ["open", "resolved", "dismissed"].includes(f.status) && typeof f.mandatory === "boolean" && Array.isArray(f.evidence));
}
const mandatoryOpen = output => output.requirements.some(r => r.status !== "satisfied") ||
  output.findings.some(f => f.status === "open" && (f.mandatory || ["blocker", "human-needed"].includes(f.class))) ||
  output.humanFeedback.some(f => f.status === "blocked" || (f.mandatory && f.status !== "addressed"));

export function completeReviewGeneration(current, { generationId, attempt, checkId, phase, output }, liveGeneration) {
  assert(current && current.generation.id === liveGeneration?.id && generationId === liveGeneration.id &&
    current.attempt === attempt && current.checkId === checkId && ["queued", "in_progress"].includes(current.phase),
    "Superseded review publication");
  assert(["completed", "operational-error", "cancelled", "timed_out"].includes(phase), "Invalid review phase");
  assert(phase !== "completed" || validateReviewOutput(output, liveGeneration), "Invalid review output");
  const ledger = structuredClone(current.ledger);
  if (phase === "completed") {
    for (const field of ["requirements", "findings", "humanFeedback"]) {
      const key = item => `${item.source || ""}:${item.id}`;
      const entries = new Map(ledger[field].map(item => [key(item), item]));
      for (const item of output[field]) {
        const prior = entries.get(key(item));
        assert(!prior || ((!prior.class || prior.class === item.class) && (!prior.mandatory || item.mandatory)),
          "Finding classification/mandatory history cannot be weakened");
        entries.set(key(item), item);
      }
      ledger[field] = [...entries.values()];
    }
  }
  return { ...current, phase, ledger, ...(phase === "completed" ? { output, outputDigest: reviewDigest(output) } : {}) };
}

export const reviewExternalId = (state) =>
  `${state.generation.repositoryId}:${state.generation.prNumber}:${state.generation.headSha}:${state.generation.id}:${state.attempt}`;

export function evaluateAi({ target, pullRequest, generation, checks = [], workpad, complete = false } = {}) {
  if (!target?.enabled || target.apps?.cadence?.app_id !== CADENCE_APP_ID ||
    pullRequest?.state !== "open" || pullRequest.number !== target.prNumber ||
    pullRequest.base?.repo?.id !== target.repository_id || pullRequest.head?.sha !== target.headSha ||
    !target.labels?.length || !target.labels.every(label => pullRequest.labels?.some(l => l.name === label))) return fail("invalid-ai-target");
  let validGeneration = false;
  try { validGeneration = generation?.id === createReviewGeneration(generation).id; } catch { /* reject malformed data */ }
  if (!complete || !generation?.feedback?.complete || !validGeneration ||
    generation.headSha !== target.headSha || generation.configRevision !== target.configRevision ||
    generation.repositoryId !== target.repository_id || generation.prNumber !== target.prNumber ||
    generation.baseSha !== pullRequest.base.sha) return fail("stale-or-incomplete-generation");
  const state = workpad?.reviewContract;
  if (!workpad?.commentId || workpad.issueId !== target.issueId || !state ||
    !same(state.generation, generation) || state.phase !== "completed" ||
    !validateReviewOutput(state.output, generation) || state.outputDigest !== reviewDigest(state.output) ||
    !state.ledger || !["requirements", "findings", "humanFeedback"].every(key => Array.isArray(state.ledger[key])) ||
    mandatoryOpen(state.output) || mandatoryOpen(state.ledger))
    return fail("missing-or-rejected-workpad");
  const candidates = checks.filter(c => c.name === CADENCE_CHECK_NAME && c.app?.id === CADENCE_APP_ID && c.head_sha === target.headSha);
  candidates.sort((a, b) => b.id - a.id);
  const check = candidates[0];
  if (!positive(state.checkId) || !positive(state.attempt) || !positive(state.passes) || state.passes > 3 || !check ||
    check.id !== state.checkId || check.external_id !== reviewExternalId(state) ||
    check.status !== "completed" || check.conclusion !== "success" ||
    candidates.filter(c => c.id === check.id).length !== 1) return fail("missing-or-stale-cadence-check");
  return { passes: true, reason: "current-ai-success", checkId: check.id, generationId: generation.id };
}
