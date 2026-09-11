import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CADENCE_APP_ID, CADENCE_CHECK_NAME, reviewDigest, resolveTarget,
  completeReviewGeneration, reviewExternalId, validateReviewOutput } from "./symphony/review-contract.mjs";
import { fetchReviewFeedback, classifyCheckReviewState } from "./fetch-pr-review-state.mjs";
import { createGitHubAppClient } from "./symphony/github-app-auth.mjs";
import { upsertCadenceWorkpad, parseCadenceWorkpad, normalizeCadenceWorkpad } from "./cadence-linear-workpad.mjs";

export const CODEX_PINS = Object.freeze({ action: "86365089eb2b84e0a8fb0717b304f8bdcb13b20e",
  cli: "0.153.4", model: "gpt-6-astra", effort: "xhigh", sandbox: "read-only",
  safetyStrategy: "drop-sudo", apiProxy: true });
export const CORE_AXES = Object.freeze(["reviewability", "scope", "test-evidence", "compatibility", "architecture", "coverage-seams"]);
// Independent ceilings: nested tree/blob reads can exhaust calls before files.
export const EVIDENCE_LIMITS = Object.freeze({ bytes: 2_000_000, calls: 100, milliseconds: 60_000, files: 200 });
const schema = JSON.parse(readFileSync(new URL("../.github/codex/review-output.schema.json", import.meta.url), "utf8"));
const prompt = readFileSync(new URL("../.github/codex/review.md", import.meta.url), "utf8");
const assert = (ok, reason) => { if (!ok) throw new Error(reason); };
const same = (a, b) => reviewDigest(a) === reviewDigest(b);
const itemKey = item => `${item.source || ""}:${item.id}`;

// Only trusted controller callbacks belong here. They acquire target/base/CI
// provenance and required source refs; PR artifacts never supply these callbacks.
// Each callback receives an abort signal. No repository command is executed.
export async function acquireReviewEvidence({ readContext, githubQuery, linearQuery, readChanges, readDocument,
  isHuman, limits = EVIDENCE_LIMITS }) {
  for (const key of Object.keys(EVIDENCE_LIMITS)) assert(Number.isSafeInteger(limits[key]) &&
    limits[key] > 0 && limits[key] <= EVIDENCE_LIMITS[key], "Invalid evidence limit");
  let bytes = 0, calls = 0;
  const abort = new AbortController();
  const deadline = Date.now() + limits.milliseconds;
  const read = async (fn, ...args) => {
    assert(++calls <= limits.calls && Date.now() < deadline, "Evidence acquisition budget exceeded");
    let timer;
    try {
      const value = await Promise.race([fn(...args, { signal: abort.signal, read }), new Promise((_, reject) => {
        timer = setTimeout(() => { abort.abort(); reject(new Error("Evidence acquisition timed out")); }, deadline - Date.now());
      })]);
      bytes += Buffer.byteLength(JSON.stringify(value));
      assert(bytes <= limits.bytes, "Evidence byte budget exceeded");
      return value;
    } finally { clearTimeout(timer); }
  };
  const context = await read(readContext);
  const target = resolveTarget(context.resolution);
  assert(typeof context.resolution.issue.identifier === "string" && typeof context.resolution.issue.description === "string" &&
    typeof context.resolution.pullRequest.body === "string", "Missing issue/PR intent");
  const project = context.resolution.issue.project;
  assert(typeof project.description === "string" && typeof project.content === "string", "Missing project intent");
  const [owner, repo] = target.full_name.split("/");
  const feedback = await fetchReviewFeedback({ owner, repo, number: target.prNumber,
    issueIdentifier: context.resolution.issue.identifier,
    githubQuery: (...args) => read(githubQuery, ...args), linearQuery: (...args) => read(linearQuery, ...args) });
  // History API failures are represented by incomplete collections. Bounds may
  // not be converted into a smaller, apparently complete evidence package.
  assert(bytes <= limits.bytes && calls <= limits.calls && !abort.signal.aborted, "Evidence acquisition budget exceeded");
  // Queueing the current head is not a prior assessment. Use the last completed
  // generation as the delta base, including across operational retries.
  const priorAssessment = [...(context.workpad?.reviewContractHistory || []), context.workpad?.reviewContract]
    .filter(state => state?.phase === "completed").at(-1);
  const review = classifyCheckReviewState({ target, pullRequest: context.resolution.pullRequest, feedback,
    workpad: { ...context.workpad, reviewContract: priorAssessment }, checks: context.ci?.checks, complete: context.ci?.complete === true,
    ancestry: context.ancestry, manualRetry: context.manualRetry, isHuman });
  const humanCommits = feedback.commits.nodes.filter(node => review.generation.feedback.records.some(record =>
    record.source === "commits" && record.id === node.id));
  const changes = await read(options => readChanges(target, review.decision, priorAssessment?.generation,
    { ...options, humanCommits }));
  assert(changes?.complete === true && changes.headSha === target.headSha && changes.baseSha === target.baseSha &&
    Array.isArray(changes.files) && changes.files.length > 0 && changes.files.length <= limits.files &&
    changes.files.every(file => ["path", "before", "after", "patch"].every(k => typeof file[k] === "string")) &&
    changes.mode === (review.decision === "incremental" ? "incremental" : "full"), "Incomplete or wrong change evidence");
  assert(Array.isArray(changes.humanCommits) && humanCommits.every(commit => changes.humanCommits.some(change =>
    change.sha === commit.id && change.parentSha === commit.parentSha && Array.isArray(change.files) &&
    change.files.every(file => ["path", "before", "after", "patch"].every(key => typeof file[key] === "string")))),
  "Incomplete human commit changes");
  if (changes.mode === "incremental") assert(changes.fromSha === review.lastReview.oid, "Wrong incremental base");
  assert(Array.isArray(context.requiredSources) && context.requiredSources.length > 0 &&
    context.requiredSources.every(s => typeof s.id === "string" && s.id.length > 0) &&
    new Set(context.requiredSources.map(s => s.id)).size === context.requiredSources.length, "Missing required source manifest");
  const documents = [];
  for (const source of context.requiredSources) {
    const document = await read(readDocument, source);
    assert(document?.id === source.id && typeof document.available === "boolean" &&
      (document.available ? typeof document.content === "string" && document.content.length > 0 :
        typeof document.reason === "string" && document.reason.length > 0), "Invalid source evidence");
    documents.push(document);
  }
  const requiredAxes = [...CORE_AXES];
  if (changes.files.some(file => /(?:\.md$|\.github\/|(?:AGENTS|CLAUDE)\.md$)/i.test(file.path))) requiredAxes.push("standing-docs");
  const humanFeedback = Object.fromEntries(Object.entries(feedback).map(([source, collection]) => [source, {
    complete: collection.complete, nodes: collection.nodes.filter(node => review.generation.feedback.records.some(record =>
      record.source === source && record.id === String(node.id))),
  }]));
  const evidence = { generation: review.generation, decision: review.decision, execution: CODEX_PINS, requiredAxes,
    issue: { id: target.issueId, identifier: context.resolution.issue.identifier, description: context.resolution.issue.description },
    project: { id: project.id, description: project.description, content: project.content },
    pullRequest: { number: target.prNumber, title: context.resolution.pullRequest.title, body: context.resolution.pullRequest.body,
      repository: target.full_name, base: target.baseSha, head: target.headSha, labels: target.labels },
    changes, documents, feedback: humanFeedback, ci: context.ci,
    previousLedger: context.workpad?.reviewContract?.ledger || { requirements: [], findings: [], humanFeedback: [] } };
  assert(Buffer.byteLength(JSON.stringify(evidence)) <= limits.bytes, "Evidence byte budget exceeded");
  return { target, generation: review.generation, workpad: context.workpad, evidence, evidenceDigest: reviewDigest(evidence) };
}

// Bind a renewable, Contents/PR-read App client to one trusted repository. Source
// manifests use immutable refs; linked documents in another repository need its
// separately scoped reader. Tree entries prevent symlink/submodule traversal.
export function createGitHubEvidenceReaders({ repository, request }) {
  // A read function is unique to one bounded acquisition; do not retain data or
  // bypass budgets between acquisitions. Git objects are immutable within it.
  const caches = new WeakMap();
  const cachedRead = (read, path) => {
    if (!caches.has(read)) caches.set(read, new Map());
    const cache = caches.get(read);
    if (!cache.has(path)) cache.set(path, read(readJson, path));
    return cache.get(path);
  };
  const readJson = async path => {
    const response = await request(path);
    assert(response.ok, `GitHub evidence read failed: HTTP ${response.status}`);
    return response.json();
  };
  const fileAt = async (ref, path, read) => {
    assert(/^[a-f0-9]{40}$/.test(ref) && typeof path === "string" &&
      path.split("/").every(p => p && ![".", ".."].includes(p)), "Invalid immutable source path");
    let sha = ref;
    const parts = path.split("/");
    for (const [index, name] of parts.entries()) {
      const tree = await cachedRead(read, `/git/trees/${sha}`);
      assert(tree.truncated === false && Array.isArray(tree.tree), "Incomplete source tree");
      const entries = tree.tree.filter(e => e.path === name), entry = entries[0];
      assert(entries.length === 1 && /^[a-f0-9]{40}$/.test(entry.sha), "Missing source path");
      sha = entry.sha;
      if (index < parts.length - 1) assert(entry.type === "tree" && entry.mode === "040000", "Unsafe source directory");
      else assert(entry.type === "blob" && ["100644", "100755"].includes(entry.mode) &&
        Number.isSafeInteger(entry.size) && entry.size <= EVIDENCE_LIMITS.bytes, "Unsafe or oversized source file");
    }
    const blob = await cachedRead(read, `/git/blobs/${sha}`);
    assert(blob.sha === sha && blob.encoding === "base64" && typeof blob.content === "string", "Invalid source blob");
    const data = Buffer.from(blob.content, "base64");
    assert(!data.includes(0), "Binary source requires explicit human evidence");
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  };
  return {
    readDocument: async (source, { read }) => {
      assert(source.repository === repository, "Wrong source repository");
      try { return { id: source.id, available: true, content: await fileAt(source.ref, source.path, read) }; }
      catch (error) {
        if (/^GitHub evidence read failed: HTTP (403|404)$/.test(error.message) || error.message === "Missing source path")
          return { id: source.id, available: false, reason: error.message };
        throw error;
      }
    },
    readChanges: async (target, decision, previous, { read, humanCommits = [] }) => {
      assert(target.full_name === repository, "Wrong change repository");
      const fromSha = decision === "incremental" ? previous?.headSha : target.baseSha;
      assert(/^[a-f0-9]{40}$/.test(fromSha) && /^[a-f0-9]{40}$/.test(target.headSha), "Invalid comparison refs");
      const compare = async (from, to = target.headSha) => {
        assert(/^[a-f0-9]{40}$/.test(from) && /^[a-f0-9]{40}$/.test(to), "Invalid comparison refs");
        const result = await cachedRead(read, `/compare/${from}...${to}?per_page=1`);
        assert(Array.isArray(result.files) && result.files.length <= EVIDENCE_LIMITS.files &&
          /^[a-f0-9]{40}$/.test(result.merge_base_commit?.sha), "Incomplete comparison");
        return result;
      };
      const comparison = await compare(target.baseSha);
      // GitHub returns at most 300 changed files on comparison page one. Our
      // lower file bound rejects that truncation boundary. Read full blobs so
      // an absent/truncated patch cannot hide code from assessment.
      const delta = decision === "incremental" ? await compare(fromSha) : comparison;
      if (decision === "incremental") assert(delta.merge_base_commit.sha === fromSha, "Unreliable incremental ancestry");
      // Same-head human feedback has an empty delta but still needs PR code to
      // verify findings. Include reverted paths that disappeared from the PR.
      const scope = comparison.files.map(file => ({ file, beforeRef: comparison.merge_base_commit.sha }));
      scope.push(...delta.files.filter(file => !comparison.files.some(f => f.filename === file.filename))
        .map(file => ({ file, beforeRef: delta.merge_base_commit.sha })));
      assert(scope.length <= EVIDENCE_LIMITS.files, "Change scope exceeds file budget");
      const readFiles = async (scope, afterRef) => {
        const files = [];
        for (const { file, beforeRef } of scope) {
          assert(["added", "removed", "modified", "renamed", "copied", "changed"].includes(file.status), "Unknown file change");
          files.push({ path: file.filename, status: file.status, previousPath: file.previous_filename || file.filename,
            beforeRef, before: file.status === "added" ? "" : await fileAt(beforeRef, file.previous_filename || file.filename, read),
            after: file.status === "removed" ? "" : await fileAt(afterRef, file.filename, read), patch: file.patch || "" });
        }
        return files;
      };
      const files = await readFiles(scope, target.headSha), commitChanges = [];
      for (const commit of humanCommits) {
        const change = await compare(commit.parentSha, commit.id);
        assert(change.merge_base_commit.sha === commit.parentSha, "Incomplete human commit ancestry");
        commitChanges.push({ sha: commit.id, parentSha: commit.parentSha,
          files: await readFiles(change.files.map(file => ({ file, beforeRef: commit.parentSha })), commit.id) });
      }
      return { complete: true, headSha: target.headSha, baseSha: target.baseSha, fromSha, deltaPaths: delta.files.map(f => f.filename),
        mode: decision === "incremental" ? "incremental" : "full", files, humanCommits: commitChanges };
    },
  };
}

// Called in a fresh assessment job with only the evidence artifact. Return
// Action inputs, not an executable shell string. ROUTE supplies the provider key
// only to the pinned Action's proxy input, never to this tree or Codex env.
export async function prepareCodexAssessment({ acquired, parentDirectory }) {
  assert(same(acquired.evidence.execution, CODEX_PINS) && reviewDigest(acquired.evidence) === acquired.evidenceDigest,
    "Evidence integrity mismatch");
  const directory = await mkdtemp(join(resolve(parentDirectory), "cadence-assessment-"));
  try {
    const tree = join(directory, "evidence"), codexHome = join(directory, "codex-home");
    await mkdir(tree, { mode: 0o700 });
    await mkdir(codexHome, { mode: 0o700 });
    await writeFile(join(tree, "evidence.json"), JSON.stringify({ ...acquired.evidence, evidenceDigest: acquired.evidenceDigest }), { mode: 0o400 });
    await writeFile(join(tree, "review.md"), prompt, { mode: 0o400 });
    await writeFile(join(tree, "output.schema.json"), JSON.stringify(schema), { mode: 0o400 });
    const outputFile = join(directory, "assessment.json");
    return { directory, uses: `openai/codex-action@${CODEX_PINS.action}`, inputs: {
      "codex-version": CODEX_PINS.cli, model: CODEX_PINS.model, effort: CODEX_PINS.effort,
      sandbox: CODEX_PINS.sandbox, "safety-strategy": CODEX_PINS.safetyStrategy,
      "codex-home": codexHome, "prompt-file": join(tree, "review.md"), "output-file": outputFile,
      "codex-args": JSON.stringify(["--cd", tree, "--skip-git-repo-check", "--ephemeral", "-c", "project_doc_max_bytes=0",
        "--output-schema", join(tree, "output.schema.json")]),
    } };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

// This closed schema uses only the following JSON Schema keywords. The schema
// file is also given to Codex; validation still runs independently in publication.
function matchesSchema(value, rule) {
  if (Object.hasOwn(rule, "const") && value !== rule.const) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  if (rule.type === "object") return value !== null && typeof value === "object" && !Array.isArray(value) &&
    rule.required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k =>
      Object.hasOwn(rule.properties, k) && matchesSchema(value[k], rule.properties[k]));
  if (rule.type === "array") return Array.isArray(value) && value.length >= rule.minItems && value.length <= rule.maxItems &&
    value.every(item => matchesSchema(item, rule.items));
  if (rule.type === "integer") return Number.isSafeInteger(value) && value >= rule.minimum;
  if (rule.type === "string") return typeof value === "string" &&
    (rule.minLength === undefined || value.trim().length >= rule.minLength) &&
    (rule.maxLength === undefined || value.length <= rule.maxLength) && (!rule.pattern || new RegExp(rule.pattern).test(value));
  return rule.type === "boolean" && typeof value === "boolean";
}

export function parseAssessment(raw, acquired) {
  assert(typeof raw === "string" && Buffer.byteLength(raw) <= 200_000, "Missing or oversized assessment");
  let output;
  try { output = JSON.parse(raw); } catch { throw new Error("Malformed assessment JSON"); }
  assert(matchesSchema(output, schema) && validateReviewOutput(output, acquired.generation), "Invalid assessment schema or generation");
  assert(output.evidenceDigest === acquired.evidenceDigest && same(output.execution, CODEX_PINS), "Wrong assessment evidence or execution");
  assert(acquired.generation.feedback.complete, "Incomplete feedback history");
  assert(acquired.evidence.ci?.complete === true, "Incomplete check evidence");
  assert(new Set(output.axes.map(a => a.id)).size === output.axes.length &&
    acquired.evidence.requiredAxes.every(id => output.axes.some(a => a.id === id)), "Missing review axis");
  assert(output.requirements.every(r => r.status !== "satisfied" || (r.coverage === "covered" && r.owners.length > 0)), "Invalid requirement coverage");
  for (const field of ["requirements", "findings", "humanFeedback"]) {
    for (const prior of acquired.evidence.previousLedger[field]) {
      const next = output[field].find(item => itemKey(item) === itemKey(prior));
      assert(next && (!prior.class || next.class === prior.class) && (!prior.mandatory || next.mandatory), "Prior ledger dropped or weakened");
      if (field === "findings" && next.status === "dismissed" && (prior.mandatory || ["blocker", "human-needed"].includes(prior.class))) {
        assert(acquired.generation.feedback.records.some(f => next.evidence.includes(`${f.source}:${f.id}`)), "Mandatory dismissal needs human evidence");
      }
    }
  }
  for (const doc of acquired.evidence.documents.filter(d => !d.available)) assert(output.findings.some(f =>
    f.class === "human-needed" && f.status === "open" && f.mandatory && f.evidence.includes(doc.id)), "Missing source requires human-needed finding");
  return output;
}

function conclusionFor(ledger) {
  if (ledger.requirements.some(r => r.status === "human-needed") ||
    ledger.findings.some(f => f.status === "open" && f.class === "human-needed") ||
    ledger.humanFeedback.some(f => f.status === "blocked")) return "action_required";
  if (ledger.requirements.some(r => r.status !== "satisfied") || ledger.findings.some(f =>
    f.status === "open" && (f.mandatory || f.class === "blocker")) ||
    ledger.humanFeedback.some(f => f.mandatory && f.status !== "addressed")) return "failure";
  return "success";
}

function checkMatches(check, acquired, state) {
  return check?.id === state.checkId && check.app?.id === CADENCE_APP_ID && check.name === CADENCE_CHECK_NAME &&
    check.head_sha === acquired.generation.headSha && check.external_id === reviewExternalId(state);
}
const checkOutputMatches = (actual, expected) => actual?.title === expected.title && actual?.summary === expected.summary;

const COMMENT_MARKER = "<!-- cadence-review-summary -->";
const shortText = (value, limit) => {
  const text = String(value).replace(/\s+/g, " ").trim();
  return (text.length > limit ? `${text.slice(0, limit - 1)}…` : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/[\\`*_[\]~]/g, "\\$&");
};

// Public prose is deliberately a small projection of the persisted assessment.
// Full definitions, evidence, execution pins and bookkeeping stay in Linear.
export function renderReviewComment(acquired, completed, conclusion, reason = "assessment") {
  const url = `https://github.com/${acquired.target.full_name}/pull/${acquired.target.prNumber}/changes/${acquired.generation.headSha}`;
  const disposition = reason !== "assessment" ? "Review unavailable" : {
    success: "Looks good", failure: "Changes needed", action_required: "Human confirmation needed",
  }[conclusion];
  const findings = completed?.ledger.findings || [];
  const required = findings.filter(f => f.status === "open" && (f.mandatory || ["blocker", "human-needed"].includes(f.class)));
  const selected = [...required, ...findings.filter(f => !required.includes(f))].slice(0, 3);
  const points = reason !== "assessment" ? [] : selected.map(f => {
    const label = f.status !== "open" ? `${f.status}: ` : required.includes(f) ? "" : "Nonblocking: ";
    return `- ${shortText(f.id, 100)} — ${label}${shortText(f.status === "open" ? f.action : f.summary, 360)}`;
  });
  const summary = reason === "assessment" ? shortText(completed.output.summary, 600) :
    reason === "comment-publication-failure" ? "The PR summary could not be updated reliably. Restore comment access and retry publication." :
    "The review could not finish reliably. Restore the provider or workpad access, then retry the review.";
  return [COMMENT_MARKER, `**${disposition}.** [Reviewing](${url})`, summary,
    ...(points.length ? [points.join("\n")] : []),
    `Details are in the Cadence workpad on ${shortText(acquired.evidence.issue.identifier, 80)}.`,
  ].join("\n\n");
}

// observe reacquires the live trusted target, complete feedback and durable
// workpad. snapshot and expected are retained from trusted acquisition, NEVER
// read from assessment output. CI progressing during assessment does not change
// its input snapshot; freshness follows the head/feedback/config generation.
// Caller serializes the entire publication per PR. Linear has no CAS; readbacks
// detect observed races, not distributed exactly-once execution.
// Consumers must treat published:false and operational reasons as job failures.
export async function publishAssessment({ snapshot, expected, outcome, observe, readCheck, writeCheck, writeComment, persist }) {
  let acquired, state;
  try {
    acquired = await observe();
    state = acquired.workpad?.reviewContract;
    assert(state && acquired.workpad.issueId === acquired.target.issueId && acquired.workpad.commentId &&
      same(state.generation, acquired.generation) && state.generation.id === expected.generationId &&
      Number.isSafeInteger(state.passes) && state.passes > 0 && state.passes <= 3 &&
      state.attempt === expected.attempt && state.checkId === expected.checkId && state.sequence === expected.sequence &&
      ["queued", "in_progress"].includes(state.phase), "Superseded assessment");
    assert(checkMatches(await readCheck(state.checkId), acquired, state), "Invalid Cadence check identity");
  } catch { return { published: false, conclusion: "failure", reason: "stale-or-unavailable-publication-context" }; }
  let output, phase = "completed", conclusion, reason = "assessment";
  try {
    assert(snapshot?.evidenceDigest === expected.evidenceDigest && reviewDigest(snapshot.evidence) === expected.evidenceDigest &&
      snapshot.generation.id === expected.generationId && same(snapshot.target, acquired.target) &&
      same(snapshot.evidence.issue, acquired.evidence.issue) && same(snapshot.evidence.pullRequest, acquired.evidence.pullRequest) &&
      same(snapshot.evidence.project, acquired.evidence.project) &&
      same(snapshot.evidence.documents, acquired.evidence.documents), "Changed acquisition evidence");
    assert(outcome?.status === "completed", "Provider did not complete");
    output = parseAssessment(outcome.output, snapshot);
    // Also validate against the current durable ledger, which could have changed
    // since acquisition without changing the human feedback watermark.
    parseAssessment(outcome.output, { ...snapshot, evidence: { ...snapshot.evidence, previousLedger: state.ledger } });
  } catch {
    phase = ["cancelled", "timed_out"].includes(outcome?.status) ? outcome.status : "operational-error";
    reason = "provider-output-or-evidence-failure";
  }
  let completed;
  try {
    completed = completeReviewGeneration(state, { generationId: state.generation.id, attempt: state.attempt,
      checkId: state.checkId, phase, ...(phase === "completed" ? { output } : {}) }, acquired.generation);
    conclusion = phase === "completed" ? conclusionFor(completed.ledger) : phase === "operational-error" ? "failure" : phase;
    if (phase === "completed" && completed.passes >= 3 && conclusion === "failure") conclusion = "action_required";
    const saved = await persist(acquired, completed);
    assert(saved?.commentId === acquired.workpad.commentId && saved.issueId === acquired.target.issueId &&
      same(saved.reviewContract, completed), "Workpad write not verified");
  } catch { conclusion = "failure"; reason = "workpad-persistence-failure"; completed = null; }
  try {
    const live = await observe();
    const liveState = live.workpad?.reviewContract;
    assert(live.generation.id === acquired.generation.id && same(live.target, acquired.target) &&
      live.workpad?.commentId === acquired.workpad.commentId && same(liveState, completed || state), "Superseded before check publication");
    const check = await readCheck(state.checkId);
    assert(checkMatches(check, live, state) && ["queued", "in_progress"].includes(check.status), "Check is no longer pending");
    let summary = renderReviewComment(acquired, completed, conclusion, reason);
    try {
      const comment = await writeComment(summary);
      assert(Number.isSafeInteger(comment?.id) && comment.id > 0 && comment.body === summary, "Comment readback failed");
    } catch {
      conclusion = "failure"; reason = "comment-publication-failure";
      summary = renderReviewComment(acquired, completed, conclusion, reason);
    }
    const afterComment = await observe();
    assert(afterComment.generation.id === live.generation.id && same(afterComment.target, live.target) &&
      afterComment.workpad?.commentId === live.workpad.commentId &&
      same(afterComment.workpad.reviewContract, liveState), "Superseded during comment publication");
    const pending = await readCheck(state.checkId);
    assert(checkMatches(pending, afterComment, state) && ["queued", "in_progress"].includes(pending.status), "Check is no longer pending");
    const body = { name: CADENCE_CHECK_NAME, external_id: reviewExternalId(state), status: "completed", conclusion,
      output: { title: `Cadence assessment: ${conclusion}`, summary } };
    await writeCheck(state.checkId, body);
    const readback = await readCheck(state.checkId);
    assert(checkMatches(readback, live, state) && readback.status === "completed" && readback.conclusion === conclusion &&
      checkOutputMatches(readback.output, body.output),
      "Check publication readback failed");
    return { published: true, conclusion, reason, checkId: state.checkId, generationId: state.generation.id };
  } catch { return { published: false, conclusion: "failure", reason: "publication-failed-or-superseded" }; }
}

// A separate minimum-scope PR-write installation token; never give it to the
// assessment job. ROUTE serializes this with check/workpad publication per PR.
export function createReviewCommentClient({ target, appOptions }) {
  const config = appOptions.config;
  assert(config.appId === CADENCE_APP_ID && config.appId === target.apps.cadence.app_id &&
    config.installationId === target.apps.cadence.installation_id && config.repositoryId === target.repository_id &&
    config.repository === target.full_name && same({ metadata: "read", ...config.permissions },
      { metadata: "read", pull_requests: "write" }), "Wrong comment credential scope");
  const request = createGitHubAppClient(appOptions);
  const endpoint = `/issues/${target.prNumber}/comments`;
  const owned = comment => comment.user?.type === "Bot" && comment.user.login === `${config.appSlug}[bot]` &&
    (!comment.performed_via_github_app || comment.performed_via_github_app.id === CADENCE_APP_ID) &&
    comment.body?.startsWith(COMMENT_MARKER);
  const find = async (read = request) => {
    const matches = [];
    for (let page = 1; page <= 10; page++) {
      const response = await read(`${endpoint}?per_page=100&page=${page}`);
      assert(response.ok, "Comment discovery failed");
      const comments = await response.json();
      assert(Array.isArray(comments), "Invalid comment collection");
      matches.push(...comments.filter(owned));
      assert(matches.length <= 1, "Duplicate Cadence summary comments");
      if (comments.length < 100 && !/rel="next"/.test(response.headers.get("link") || "")) return matches[0];
    }
    throw new Error("Comment discovery budget exceeded");
  };
  return async body => {
    assert(typeof body === "string" && body.startsWith(COMMENT_MARKER) && body.length <= 3000, "Invalid comment summary");
    const current = await find();
    if (current?.body === body) return current;
    if (current) assert(Number.isSafeInteger(current.id) && current.id > 0, "Invalid comment ID");
    const response = await request(current ? `/issues/comments/${current.id}` : endpoint, {
      method: current ? "PATCH" : "POST", body: { body }, readback: async read => {
        const found = await find(read);
        if (found?.body === body) return { applied: true, response: new Response(JSON.stringify(found)) };
        // A failed POST may have created a comment with an unexpected body.
        // Do not retry a creation while any owned comment exists.
        assert(current || !found, "Comment creation outcome unknown");
        return { applied: false };
      },
    });
    assert(response.ok, "Comment write failed");
    const written = await response.json(), readback = await find();
    assert(owned(readback || {}) && readback.id === written.id && (!current || readback.id === current.id) &&
      readback.body === body, "Comment publication readback failed");
    return readback;
  };
}

// Production adapters retain the landed renewable App client and sole Cadence
// workpad writer. ROUTE owns credential acquisition/revocation in finally.
export function createPublicationClients({ target, appOptions, linearToken, linearFetch = fetch }) {
  const config = appOptions.config;
  assert(config.appId === target.apps.cadence.app_id && config.appId === CADENCE_APP_ID &&
    config.installationId === target.apps.cadence.installation_id && config.repositoryId === target.repository_id &&
    config.repository === target.full_name && same({ metadata: "read", ...config.permissions },
      { metadata: "read", checks: "write" }), "Wrong publisher credential scope");
  const request = createGitHubAppClient(appOptions);
  const readCheck = async id => {
    assert(Number.isSafeInteger(id) && id > 0, "Invalid check ID");
    const response = await request(`/check-runs/${id}`);
    assert(response.ok, "Check read failed");
    return response.json();
  };
  return { readCheck, writeCheck: async (id, body) => {
    const response = await request(`/check-runs/${id}`, { method: "PATCH", body, readback: async read => {
      const response = await read(`/check-runs/${id}`), value = await response.clone().json();
      return value.status === body.status && value.conclusion === body.conclusion && value.external_id === body.external_id &&
        (!body.output || checkOutputMatches(value.output, body.output))
        ? { applied: true, response } : { applied: false };
    } });
    assert(response.ok, "Check write failed");
  }, persist: async (acquired, reviewContract) => {
    const saved = await upsertCadenceWorkpad({ issueIdentifier: acquired.evidence.issue.identifier, token: linearToken,
      fetchImpl: linearFetch, liveGeneration: acquired.generation, workpad: { ...normalizeCadenceWorkpad(acquired.workpad), reviewContract,
        status: reviewContract.phase, summary: reviewContract.output?.summary || "Cadence operational failure" } });
    return { ...saved, reviewContract: parseCadenceWorkpad(saved.body).reviewContract };
  } };
}
