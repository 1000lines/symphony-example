#!/usr/bin/env node
// Compute the re-review state of a pull request, with no external dependencies.
//
// Reads the PR's GitHub timeline (one GraphQL call), finds our last review
// (the latest PullRequestReview by the reviewer login), and reports what has
// changed since — so a re-review can skip untouched PRs and otherwise review
// only the delta. The PR itself is the ledger; no external state is stored.
//
// Auth:  GH_TOKEN (existing App installation token with Metadata/PR read).
// Repo:  defaults to example-org/example-repo; override with REPO_SLUG=owner/name.
// Who:   the reviewer identity defaults to example-cadence-bot; override with
//        CADENCE_REVIEWER_LOGIN.
//
// Usage:   node scripts/fetch-pr-review-state.mjs <pr-number>
// Output:  JSON { decision, reviewStatus, staleApproval, headRefOid, isDraft,
//          lastReview, pagedOut, since, humanGroundedSince, workpadSince,
//          ignoredSince }
//
// decision is one of:
//   first-review        no prior review by us; review the whole PR
//   skip                we reviewed and nothing changed since
//   incremental         changed since our review; review since.baseOid..headRefOid
//   full-review-rebased head was force-pushed since our review; re-review fully
//   full-review-paged-out  review is older than the 100-item window
//
// Timeline limit: timelineItems(last:100) is not paginated. If our review is >100
// events back it won't be found and we fall back to a full review (always safe,
// just redundant) — flagged as full-review-paged-out rather than failing silently.

import { fileURLToPath } from "node:url";
import {
  classifyGitHubActor,
  normalize,
  verifyGitHubHumanWriteAccess,
} from "./github-actor-classification.mjs";

const QUERY = `query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      headRefOid
      isDraft
      timelineItems(last:100, itemTypes:[PULL_REQUEST_COMMIT, ISSUE_COMMENT, PULL_REQUEST_REVIEW, HEAD_REF_FORCE_PUSHED_EVENT, READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT]){
        pageInfo{ hasPreviousPage }
        nodes{
          __typename
          ... on PullRequestCommit{ commit{ oid committedDate author{ user{ login } } committer{ user{ login } } } }
          ... on IssueComment{ author{login __typename ... on User{databaseId}} createdAt }
          ... on PullRequestReview{ author{login __typename ... on User{databaseId}} submittedAt state commit{oid} }
          ... on HeadRefForcePushedEvent{ actor{login} createdAt afterCommit{oid} }
          ... on ReadyForReviewEvent{ actor{login} createdAt }
          ... on ConvertToDraftEvent{ actor{login} createdAt }
        }
      }
    }
  }
}`;

const actorOf = (node) =>
  node.author?.login ||
  node.actor?.login ||
  node.commit?.author?.user?.login ||
  node.commit?.committer?.user?.login ||
  null;

const timestampOf = (node) =>
  node.submittedAt || node.createdAt || node.commit?.committedDate || null;

const oidOf = (node) => node.commit?.oid || node.afterCommit?.oid || null;

const codeChangeTypes = new Set([
  "PullRequestCommit",
  "HeadRefForcePushedEvent",
]);

const classifyActivity = ({ node, reviewer, classifyActor }) => {
  const actor = actorOf(node);
  const actorClassification = classifyActor(actor);
  const isSelf = Boolean(actor) && normalize(actor) === normalize(reviewer);
  const isCodeChange = codeChangeTypes.has(node.__typename);
  const isFeedback = ["IssueComment", "PullRequestReview"].includes(node.__typename);
  const trustedHuman = isFeedback ? node.authority?.allowed === true : actorClassification.humanFacing;
  const reviewRelevant =
    !isSelf && (isCodeChange || trustedHuman);
  const humanGrounded = reviewRelevant && trustedHuman;

  return {
    type: node.__typename,
    actor,
    at: timestampOf(node),
    oid: oidOf(node),
    ...(node.state ? { state: node.state } : {}),
    actorClassification,
    ...(isFeedback ? { authority: node.authority || { allowed: false, contentTrust: "untrusted", reason: "permission-not-verified" } } : {}),
    isSelf,
    humanGrounded,
    reviewRelevant,
    routing: isSelf ? "ignore" : reviewRelevant ? "review" : "workpad",
  };
};

const runQuery = async (variables) => {
  const token = process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      "Set GH_TOKEN (a GitHub token with pull-request read access)."
    );
  }
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(
      `GitHub GraphQL error: ${JSON.stringify(payload.errors || payload)}`
    );
  }
  const pr = payload.data?.repository?.pullRequest;
  if (!pr) {
    throw new Error(
      `PR #${variables.number} not found in ${variables.owner}/${variables.repo}.`
    );
  }
  pr.timelineItems.nodes = await markFeedbackAuthority(pr.timelineItems.nodes, {
    repository: `${variables.owner}/${variables.repo}`, token,
  });
  return pr;
};

const reviewStatusFor = ({ decision, headRefOid, lastReview, since }) => {
  if (!lastReview) {
    return {
      reviewStatus:
        decision === "first-review" ? "unreviewed" : "full-re-review",
      staleApproval: false,
      staleApprovalReasons: [],
    };
  }

  if (lastReview.state === "APPROVED") {
    const staleApprovalReasons = [];
    if (!lastReview.oid) {
      staleApprovalReasons.push("missing-review-commit");
    } else if (lastReview.oid !== headRefOid) {
      staleApprovalReasons.push("head-sha-changed");
    }
    if (since.length > 0) {
      staleApprovalReasons.push("review-relevant-activity");
    }

    return {
      reviewStatus:
        staleApprovalReasons.length > 0 ? "stale-approval" : "fresh-approval",
      staleApproval: staleApprovalReasons.length > 0,
      staleApprovalReasons,
    };
  }

  if (decision === "skip") {
    return {
      reviewStatus: "skipped-review",
      staleApproval: false,
      staleApprovalReasons: [],
    };
  }

  return {
    reviewStatus:
      decision === "incremental" ? "incremental-re-review" : "full-re-review",
    staleApproval: false,
    staleApprovalReasons: [],
  };
};

export const classifyPrReviewState = (
  pr,
  reviewer,
  { classifyActor = classifyGitHubActor } = {}
) => {
  const nodes = pr.timelineItems.nodes;
  const pagedOut = pr.timelineItems.pageInfo.hasPreviousPage;

  let anchorIndex = -1;
  let lastReview = null;
  nodes.forEach((node, i) => {
    if (
      node.__typename === "PullRequestReview" &&
      normalize(actorOf(node)) === normalize(reviewer)
    ) {
      anchorIndex = i;
      lastReview = {
        oid: node.commit?.oid || null,
        submittedAt: node.submittedAt,
        state: node.state,
      };
    }
  });

  if (anchorIndex === -1) {
    const decision = pagedOut ? "full-review-paged-out" : "first-review";
    return {
      decision,
      ...reviewStatusFor({
        decision,
        headRefOid: pr.headRefOid,
        lastReview: null,
        since: [],
      }),
      headRefOid: pr.headRefOid,
      isDraft: pr.isDraft,
      lastReview: null,
      pagedOut,
      since: [],
      humanGroundedSince: [],
      workpadSince: [],
      ignoredSince: [],
    };
  }

  const after = nodes
    .slice(anchorIndex + 1)
    .map((node) => classifyActivity({ node, reviewer, classifyActor }));
  const since = after.filter((activity) => activity.reviewRelevant);
  const humanGroundedSince = since.filter((activity) => activity.humanGrounded);
  const workpadSince = after.filter(
    (activity) => activity.routing === "workpad"
  );
  const ignoredSince = after.filter(
    (activity) => activity.routing === "ignore"
  );
  const rebased = since.some(
    (activity) => activity.type === "HeadRefForcePushedEvent"
  );

  let decision = "skip";
  if (rebased) decision = "full-review-rebased";
  else if (since.length > 0) decision = "incremental";

  const reviewStatus = reviewStatusFor({
    decision,
    headRefOid: pr.headRefOid,
    lastReview,
    since,
  });

  return {
    decision,
    ...reviewStatus,
    headRefOid: pr.headRefOid,
    isDraft: pr.isDraft,
    lastReview,
    pagedOut,
    since,
    humanGroundedSince,
    workpadSince,
    ignoredSince,
  };
};

export async function markFeedbackAuthority(nodes, { repository, token, fetchImpl } = {}) {
  // Share duplicate author reads within this acquisition only. The next event
  // or acquisition gets a new map and observes revoked access.
  const authors = new Map();
  return Promise.all(nodes.map(async node => {
    const author = { login: node.author?.login, type: node.author?.__typename, id: node.author?.databaseId };
    const key = JSON.stringify([normalize(author.login), author.type, author.id]);
    if (!authors.has(key)) authors.set(key, verifyGitHubHumanWriteAccess({ author, repository, token, fetchImpl }));
    return { ...node, authority: await authors.get(key) };
  }));
}

const main = async () => {
  const number = Number(process.argv[2]);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(
      "Usage: node scripts/fetch-pr-review-state.mjs <pr-number>"
    );
  }
  const [owner, repo] = (
    process.env.REPO_SLUG || "example-org/example-repo"
  ).split("/");
  const reviewer = process.env.CADENCE_REVIEWER_LOGIN || (process.env.CADENCE_REVIEWER || "example-cadence-bot").trim().toLowerCase();
  const pr = await runQuery({ owner, repo, number });
  process.stdout.write(
    `${JSON.stringify(classifyPrReviewState(pr, reviewer), null, 2)}\n`
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
