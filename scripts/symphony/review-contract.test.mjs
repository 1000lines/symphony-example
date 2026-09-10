import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CADENCE_APP_ID, REVIEW_SCHEMA, createReviewGeneration, feedbackWatermark,
  loadRepositoryMapping, resolveTarget, evaluateCi, evaluateAi, queueReviewGeneration,
  completeReviewGeneration, reviewExternalId, reviewDigest, validateReviewOutput } from "./review-contract.mjs";

const head = "a".repeat(40), base = "b".repeat(40), revision = "c".repeat(40);
const mappingFile = JSON.parse(readFileSync(new URL("../../.github/symphony/repositories.yml", import.meta.url)));
const sources = () => Object.fromEntries(["reviews", "comments", "threads", "linearComments"]
  .map(key => [key, { complete: true, nodes: [] }]));
const human = (id = "feedback-1") => ({ id, body: "Fix this", updatedAt: "2026-09-10T01:00:00Z", author: { login: "human" } });
const generation = (extra = {}) => createReviewGeneration({ repositoryId: 100, prNumber: 4,
  headSha: head, baseSha: base, configRevision: revision, feedback: feedbackWatermark(sources()), ...extra });
const output = gen => ({ schema: REVIEW_SCHEMA, repositoryId: 100, prNumber: 4, headSha: gen.headSha,
  generationId: gen.id, sourcesComplete: true, summary: "All requirements met",
  requirements: [{ id: "R05", status: "satisfied", summary: "Gate enforced", evidence: ["fixture"] }],
  findings: [], humanFeedback: [] });
function fixture() {
  const mapping = structuredClone(mappingFile);
  const entry = mapping.repositories[0];
  Object.assign(entry, { enabled: true, repository_id: 100 });
  entry.apps.symphony.installation_id = 11;
  entry.apps.cadence.installation_id = 12;
  const repository = { id: 100, full_name: entry.full_name, owner: { login: "1000lines" }, default_branch: "main" };
  const pullRequest = { number: 4, state: "open", head: { sha: head, ref: "task" },
    base: { sha: base, repo: { id: 100 } }, labels: [{ name: "pink" }, { name: "symphony" }] };
  const context = { mapping, revision, hostRevision: revision, controllerRevision: revision,
    repository, pullRequest, request: { repositoryId: 100, prNumber: 4, headSha: head },
    issue: { id: "issue", team: { id: entry.linear.team_id }, project: { id: entry.linear.project_id } },
    associations: ["issue"], installations: [11, 12].map((id, i) => ({ id,
      app_id: i ? CADENCE_APP_ID : 4866508, account: { login: "1000lines" }, suspended_at: null, repository_ids: [100] })) };
  const target = resolveTarget(context);
  const run = { id: 20, run_number: 1, run_attempt: 1, path: ".github/workflows/ci.yml", event: "pull_request",
    repository: { id: 100 }, head_sha: head, head_branch: "task", status: "completed", conclusion: "success", check_suite_id: 30 };
  const names = ["CI Required", ...entry.ci.required_checks[0].children.map(c => c.name)];
  const jobs = names.map((name, i) => ({ id: 40 + i, name, run_id: 20, run_attempt: 1, head_sha: head,
    tested_sha: head, status: "completed", conclusion: "success", check_run_url: `https://api.github.com/checks/${50 + i}` }));
  const checks = jobs.map((job, i) => ({ id: 50 + i, url: job.check_run_url, name: job.name,
    app: { id: 15368 }, head_sha: head, check_suite: { id: 30 }, status: "completed", conclusion: "success" }));
  const gen = generation();
  const queued = queueReviewGeneration(null, gen, { checkId: 90 });
  const state = completeReviewGeneration(queued, { generationId: gen.id, attempt: 1, checkId: 90,
    phase: "completed", output: output(gen) }, gen);
  const check = { id: 90, name: "Cadence Review", app: { id: CADENCE_APP_ID }, head_sha: head,
    external_id: reviewExternalId(state), status: "completed", conclusion: "success" };
  return { context, target, gen, queued, state,
    ci: { target, runs: [run], jobs, checks, complete: true },
    ai: { target, pullRequest, generation: gen, checks: [check], complete: true,
      workpad: { commentId: "workpad", issueId: "issue", reviewContract: state } } };
}

test("repository mapping stays disabled; resolver returns only mapped authority", () => {
  assert.ok(mappingFile.repositories.every(t => t.enabled === false));
  const { context, target } = fixture();
  assert.equal(target.apps.cadence.installation_id, 12);
  assert.equal(target.configRevision, revision);
  assert.equal(target.issueId, "issue");
  assert.doesNotThrow(() => resolveTarget(context));
});

test("target authorization rejects identity, configuration, installation and association substitutions", () => {
  for (const change of [
    c => { c.request.repositoryId = "100"; }, c => { c.request.repositoryId = 101; },
    c => { c.request.installationId = 12; }, c => { c.request.projectId = "other"; },
    c => { c.hostRevision = base; }, c => { c.controllerRevision = base; },
    c => { c.mapping.repositories[0].enabled = false; },
    c => { c.mapping.repositories.push(c.mapping.repositories[0]); },
    c => { c.repository.full_name = "other/repo"; }, c => { c.repository.owner.login = "other"; },
    c => { c.pullRequest.state = "closed"; }, c => { c.pullRequest.head.sha = base; },
    c => { c.pullRequest.base.repo.id = 101; }, c => { c.pullRequest.labels = []; },
    c => { c.issue.project.id = "another-project"; }, c => { c.issue.team.id = "other"; },
    c => { c.associations.push("another-issue"); }, c => { c.associations = []; },
    c => { c.installations[0].repository_ids = []; }, c => { c.installations[1].app_id = 1; },
    c => { c.installations[1].account.login = "jeremycarroll"; },
    c => { c.installations[1].suspended_at = "2026-09-10"; },
    c => { c.mapping.repositories[1].apps.cadence.installation_id = 12; },
    c => { c.mapping.repositories[0].ci.required_checks = []; },
    c => { c.mapping.repositories[0].dispatch.ref = "refs/heads/task"; },
  ]) {
    const { context } = fixture(); change(context);
    assert.throws(() => resolveTarget(context), change.toString());
  }
});

test("loader pins contents to protected main and rejects stale/unprotected/denied reads", async () => {
  for (const mode of ["success", "unprotected", "stale", "denied", "malformed"]) {
    const urls = [];
    const promise = loadRepositoryMapping({ controller: mappingFile.controller, expectedRevision: revision,
      token: "fixture-only", fetchImpl: async url => {
        urls.push(url);
        return { ok: mode !== "denied", status: 403, json: async () => url.includes("branches/")
          ? { protected: mode !== "unprotected", commit: { sha: mode === "stale" ? head : revision } }
          : { encoding: "base64", content: Buffer.from(mode === "malformed" ? "?" : JSON.stringify(mappingFile)).toString("base64") } };
      } });
    if (mode === "success") {
      assert.equal((await promise).revision, revision);
      assert.ok(urls[1].endsWith(`?ref=${revision}`));
    } else await assert.rejects(promise);
  }
});

test("CI requires exact workflow, event, run attempt, App, checkout and every child", () => {
  assert.equal(evaluateCi(fixture().ci).passes, true);
  for (const change of [
    c => { c.complete = false; }, c => { c.runs = []; }, c => { c.checks = []; },
    c => { c.target.ci.required_checks = []; }, c => { c.target.ci.required_checks[0].events = []; },
    c => { c.runs[0].path = ".github/workflows/review.yml"; }, c => { c.runs[0].event = "pull_request_target"; },
    c => { c.runs[0].head_branch = "other"; }, c => { c.runs[0].head_sha = base; },
    c => { c.runs[0].repository.id = 101; }, c => { c.runs[0].run_attempt = 2; },
    c => { c.runs.push({ ...c.runs[0], id: 21, run_number: 2, status: "queued", conclusion: null }); },
    c => { c.runs.push({ ...c.runs[0] }); }, c => { c.jobs.push({ ...c.jobs[0] }); },
    c => { c.jobs.pop(); }, c => { c.jobs[0].tested_sha = base; },
    c => { c.jobs[0].check_run_url = "other"; }, c => { c.checks[0].app.id = 999; },
    c => { c.checks[0].head_sha = base; }, c => { c.checks[0].check_suite.id = 31; },
    c => { c.checks.push({ ...c.checks[0], id: 300 }); },
  ]) {
    const { ci } = fixture(); change(ci);
    assert.equal(evaluateCi(ci).passes, false, change.toString());
  }
  for (const conclusion of ["failure", "cancelled", "timed_out", "skipped", "neutral", "action_required", "unknown", null]) {
    for (const surface of ["runs", "jobs", "checks"]) {
      const { ci } = fixture(); ci[surface][0].conclusion = conclusion;
      assert.equal(evaluateCi(ci).passes, false, `${surface}: ${conclusion}`);
    }
    const { ci } = fixture(); ci.jobs[1].conclusion = conclusion;
    assert.equal(evaluateCi(ci).passes, false, `child: ${conclusion}`);
  }
});

function addCiAttempt(ci, { id = 21, run_number = 2, run_attempt = 1, event = "push" } = {}) {
  const template = fixture().ci;
  const run = { ...template.runs[0], id, run_number, run_attempt, event, check_suite_id: id + 1000 };
  const jobs = template.jobs.map((job, i) => ({ ...job, id: id * 100 + run_attempt * 10 + i,
    run_id: id, run_attempt, check_run_url: `https://api.github.com/checks/${id}-${run_attempt}-${i}` }));
  const checks = template.checks.map((check, i) => ({ ...check, id: jobs[i].id,
    url: jobs[i].check_run_url, check_suite: { id: run.check_suite_id } }));
  ci.runs.push(run); ci.jobs.push(...jobs); ci.checks.push(...checks);
  return { run, jobs, checks };
}

test("CI retains evidence for every peer run at the current head", () => {
  const { ci } = fixture();
  addCiAttempt(ci);
  const result = evaluateCi(ci);
  assert.equal(result.passes, true);
  assert.deepEqual(result.evidence.map(e => e.runId).sort(), [20, 21]);
  assert.ok(result.evidence.every(e => e.jobs.length === 5));
});

test("a successful peer cannot hide nonpassing push or PR runs in either order", () => {
  for (const event of ["push", "pull_request"]) {
    for (const status of ["completed", "queued", "in_progress"]) {
      const conclusions = status === "completed"
        ? ["failure", "cancelled", "timed_out", "skipped", "neutral", "action_required", "unknown", null] : [null];
      for (const conclusion of conclusions) {
        for (const failingNumber of [1, 2]) {
          const { ci } = fixture();
          const peer = addCiAttempt(ci);
          const bad = failingNumber === 1 ? ci.runs[0] : peer.run;
          const good = failingNumber === 1 ? peer.run : ci.runs[0];
          Object.assign(bad, { event, status, conclusion });
          good.event = event === "push" ? "pull_request" : "push";
          for (const runs of [ci.runs, [...ci.runs].reverse()]) {
            assert.equal(evaluateCi({ ...ci, runs }).passes, false,
              `${event} run ${failingNumber}: ${status}/${conclusion}`);
          }
        }
      }
    }
  }
});

test("each peer needs its own verified successful checks and children", () => {
  for (const change of [
    c => { c.jobs = c.jobs.filter(j => j.run_id !== 20); },
    c => { c.jobs[1].conclusion = "failure"; },
    c => { c.checks[1].conclusion = "failure"; },
    c => { c.checks[0].app.id = 999; },
    c => { c.jobs[0].tested_sha = base; },
  ]) {
    const { ci } = fixture(); addCiAttempt(ci); change(ci);
    assert.equal(evaluateCi(ci).passes, false, change.toString());
  }
});

test("only genuine later attempts supersede a run, never a distinct peer", () => {
  const { ci } = fixture();
  ci.runs[0].conclusion = "failure";
  const retry = addCiAttempt(ci, { id: 20, run_number: 1, run_attempt: 2, event: "pull_request" });
  addCiAttempt(ci);
  assert.equal(evaluateCi(ci).passes, true);
  assert.equal(evaluateCi(ci).evidence.find(e => e.runId === 20).attempt, 2);
  for (const conclusion of ["failure", null]) {
    retry.run.conclusion = conclusion;
    retry.run.status = conclusion ? "completed" : "queued";
    assert.equal(evaluateCi(ci).passes, false);
  }
  for (const change of [
    c => { c.runs[1].id = 99; },
    c => { c.runs[1].run_number = 3; },
    c => { c.runs[1].event = "push"; },
    c => { c.runs.push({ ...c.runs[1] }); },
  ]) {
    const invalid = structuredClone(ci);
    Object.assign(invalid.runs[1], { status: "completed", conclusion: "success" });
    change(invalid);
    assert.equal(evaluateCi(invalid).passes, false, change.toString());
  }
});

test("AI cannot accept a completed review acquired with incomplete feedback sources", () => {
  for (const source of Object.keys(sources())) {
    const { ai, gen } = fixture();
    const incomplete = sources(); incomplete[source].complete = false;
    const next = generation({ feedback: feedbackWatermark(incomplete) });
    const queued = queueReviewGeneration(null, next, { checkId: 90 });
    const completed = completeReviewGeneration(queued, { generationId: next.id, attempt: 1,
      checkId: 90, phase: "completed", output: output(next) }, next);
    ai.generation = next; ai.workpad.reviewContract = completed;
    ai.checks[0].external_id = reviewExternalId(completed);
    assert.notEqual(next.id, gen.id);
    assert.equal(evaluateAi(ai).passes, false, source);
  }
});

test("legacy bot accounts cannot create feedback generations or reset the pass cap", () => {
  for (const login of [process.env.SYMPHONY_BOT_USER || "example-symphony-bot",
    process.env.CADENCE_REVIEWER || "example-cadence-bot", "another-app[bot]"]) {
    const feedback = sources();
    feedback.comments.nodes = [{ ...human(), author: { login, __typename: "User" } }];
    assert.deepEqual(feedbackWatermark(feedback).records, [], login);
    assert.equal(generation({ feedback: feedbackWatermark(feedback) }).resetKey, generation().resetKey, login);
  }
});

test("AI success requires exact check/generation, closed ledger and durable workpad", () => {
  assert.equal(evaluateAi(fixture().ai).passes, true);
  for (const change of [
    a => { a.complete = false; }, a => { a.generation = {}; },
    a => { a.target.apps.cadence.app_id = 5; }, a => { a.pullRequest.state = "closed"; },
    a => { a.pullRequest.labels = []; }, a => { a.pullRequest.head.sha = base; },
    a => { a.checks[0].app.id = 1; }, a => { a.checks[0].name = "Review"; },
    a => { a.checks[0].head_sha = base; }, a => { a.checks[0].external_id = "old-generation"; },
    a => { a.checks.push({ ...a.checks[0], id: 91, status: "queued", conclusion: null }); },
    a => { a.workpad = null; }, a => { a.workpad.commentId = null; }, a => { a.workpad.issueId = "other"; },
    a => { a.workpad.reviewContract.phase = "queued"; }, a => { a.workpad.reviewContract.output = null; },
    a => { a.workpad.reviewContract.outputDigest = "wrong"; },
    a => { const f = sources(); f.comments.nodes.push(human()); a.generation = generation({ feedback: feedbackWatermark(f) }); },
    a => { a.generation = generation({ baseSha: head }); },
    a => { a.generation = generation({ configRevision: head }); },
    a => { a.generation = generation({ manualRetry: 1 }); },
  ]) {
    const { ai } = fixture(); change(ai);
    assert.equal(evaluateAi(ai).passes, false, change.toString());
  }
  for (const conclusion of ["neutral", "skipped", "unknown", "failure", "cancelled", "timed_out", "action_required", null]) {
    const { ai } = fixture(); ai.checks[0].conclusion = conclusion;
    assert.equal(evaluateAi(ai).passes, false);
  }
});

test("malformed output, omitted feedback, mandatory findings and retained blockers reject", () => {
  const gen = generation();
  for (const bad of [null, {}, { ...output(gen), findings: [null] }, { ...output(gen), requirements: [] },
    { ...output(gen), sourcesComplete: false }, { ...output(gen), findings: [{ id: "F", summary: "bad", status: "open", class: "unknown" }] }]) {
    assert.equal(validateReviewOutput(bad, gen), false);
  }
  const f = sources(); f.threads.nodes = [human()];
  const feedbackGen = generation({ feedback: feedbackWatermark(f) });
  assert.equal(validateReviewOutput(output(feedbackGen), feedbackGen), false);
  for (const [kind, mandatory, passes] of [["blocker", false, false], ["human-needed", false, false],
    ["should-fix", false, true], ["suggestion", false, true], ["suggestion", true, false]]) {
    const { ai, queued } = fixture();
    const assessed = { ...output(gen), findings: [{ id: "F1", class: kind, mandatory, status: "open", summary: "finding", evidence: [] }] };
    ai.workpad.reviewContract = completeReviewGeneration(queued, { generationId: gen.id, attempt: 1,
      checkId: 90, phase: "completed", output: assessed }, gen);
    assert.equal(evaluateAi(ai).passes, passes, kind);
    if (kind !== "blocker") continue;
    const nextGen = generation({ manualRetry: 1 });
    const next = queueReviewGeneration(ai.workpad.reviewContract, nextGen, { checkId: 91 });
    const completed = completeReviewGeneration(next, { generationId: nextGen.id, attempt: 1,
      checkId: 91, phase: "completed", output: output(nextGen) }, nextGen);
    ai.workpad.reviewContract = completed;
    ai.generation = nextGen;
    ai.checks = [{ ...ai.checks[0], id: 91, external_id: reviewExternalId(completed) }];
    assert.equal(evaluateAi(ai).passes, false, "omission does not close old blocker");
    assert.throws(() => completeReviewGeneration(next, { generationId: nextGen.id, attempt: 1, checkId: 91,
      phase: "completed", output: { ...assessed, generationId: nextGen.id, findings: [{ ...assessed.findings[0], class: "suggestion" }] } }, nextGen), /weakened/);
  }
});

test("all feedback changes invalidate generations; generated bookkeeping cannot reset the cap", () => {
  const f = sources(); f.comments.nodes = [human()];
  const before = generation({ feedback: feedbackWatermark(f) });
  f.linearComments.nodes = [{ ...human("workpad"), body: "\n## Codex Workpad\nNew progress" }];
  assert.equal(generation({ feedback: feedbackWatermark(f) }).id, before.id);
  f.comments.nodes[0].body = "edited at same timestamp";
  assert.notEqual(generation({ feedback: feedbackWatermark(f) }).id, before.id);
  for (const source of Object.keys(f)) {
    const next = sources(); next[source].nodes = [human()];
    assert.notEqual(generation({ feedback: feedbackWatermark(next) }).id, generation().id);
    next[source].complete = false;
    assert.equal(feedbackWatermark(next).complete, false);
  }
  const bot = sources(); bot.comments.nodes = [{ ...human(), author: { login: "app", __typename: "Bot" } }];
  assert.deepEqual(feedbackWatermark(bot).records, []);
  const invalid = sources(); invalid.reviews.nodes = [{ ...human(), updatedAt: null }];
  assert.equal(feedbackWatermark(invalid).complete, false);
  const g = generation(); let current;
  for (let pass = 1; pass <= 3; pass++) {
    const nextGen = generation({ headSha: String(pass).repeat(40) });
    current = queueReviewGeneration(current, nextGen, { checkId: 100 + pass });
    assert.equal(current.passes, pass);
    assert.equal(queueReviewGeneration(current, nextGen, { checkId: 100 + pass }), current);
    current = completeReviewGeneration(current, { generationId: nextGen.id, attempt: 1,
      checkId: 100 + pass, phase: "completed", output: output(nextGen) }, nextGen);
  }
  assert.throws(() => queueReviewGeneration(current, g, { checkId: 104 }), /Three-pass/);
  assert.equal(queueReviewGeneration(current, before, { checkId: 105 }).passes, 1);
});

test("late publication and extra operational retries cannot overwrite current review", () => {
  const { queued, gen } = fixture();
  const completion = { generationId: gen.id, attempt: 1, checkId: 90, phase: "completed", output: output(gen) };
  assert.throws(() => completeReviewGeneration(queued, completion, generation({ headSha: base })), /Superseded/);
  assert.throws(() => completeReviewGeneration(queued, { ...completion, attempt: 2 }, gen), /Superseded/);
  const error = completeReviewGeneration(queued, { ...completion, phase: "operational-error" }, gen);
  const retry = queueReviewGeneration(error, gen, { checkId: 91, operationalRetry: true });
  assert.equal(retry.passes, 1);
  const again = completeReviewGeneration(retry, { ...completion, attempt: 2, checkId: 91, phase: "operational-error" }, gen);
  assert.throws(() => queueReviewGeneration(again, gen, { checkId: 92, operationalRetry: true }), /unavailable/);
  assert.throws(() => completeReviewGeneration(retry, completion, gen), /Superseded/);
  assert.equal(reviewDigest(gen), reviewDigest(structuredClone(gen)));
});

test("cross-owner target requires distinct target and controller installations", () => {
  const { context } = fixture();
  const rust = context.mapping.repositories[1];
  rust.enabled = true; rust.apps.symphony.installation_id = 21; rust.apps.cadence.installation_id = 22;
  context.controllerRepository = structuredClone(context.repository);
  context.repository = { id: rust.repository_id, full_name: rust.full_name, owner: { login: "jeremycarroll" }, default_branch: "main" };
  context.request.repositoryId = rust.repository_id; context.pullRequest.base.repo.id = rust.repository_id;
  context.installations.push(...[21, 22].map((id, i) => ({ id, app_id: i ? 4866513 : 4866508,
    account: { login: "jeremycarroll" }, suspended_at: null, repository_ids: [rust.repository_id] })));
  const resolved = resolveTarget(context);
  assert.equal(resolved.apps.cadence.installation_id, 22);
  assert.equal(resolved.controller.apps.symphony.installation_id, 11);
  for (const change of [c => { c.controllerRepository.id = 999; },
    c => { c.installations = c.installations.filter(i => i.id !== 11); },
    c => { c.mapping.repositories[0].enabled = false; },
    c => { c.mapping.repositories[1].apps.cadence.installation_id = 12; }]) {
    const invalid = structuredClone(context); change(invalid); assert.throws(() => resolveTarget(invalid));
  }
});

test("identical completed generation coalesces; retries require explicit operational intent", () => {
  const { state, gen } = fixture();
  assert.equal(queueReviewGeneration(state, gen, { checkId: 999 }), state);
  assert.throws(() => queueReviewGeneration(state, gen, { checkId: 999, operationalRetry: true }), /unavailable/);
});
