#!/usr/bin/env node
// Classify GitHub actors for Symphony review/rework routing, with no external
// dependencies. The pure classifier accepts explicit allowlists and pre-fetched
// team membership; the optional GitHub path only resolves humans/ai team
// membership and returns JSON.

import { fileURLToPath } from "node:url";

export const ACTOR_CLASSIFICATION = Object.freeze({
  HUMAN: "human",
  AI_ACTOR: "ai_actor",
  DEPENDENCY_BOT: "dependency_bot",
  NON_HUMAN_BOT: "non_human_bot",
  UNKNOWN: "unknown",
});

export const KNOWN_AI_ACTORS = Object.freeze({
  [(process.env.SYMPHONY_BOT_USER || "example-symphony-bot").toLowerCase()]: { actorKind: "coding" },
  [(process.env.CADENCE_REVIEWER || "example-cadence-bot").toLowerCase()]: { actorKind: "review" },
  "claude[bot]": { actorKind: "coding" },
});

export const KNOWN_DEPENDENCY_BOTS = Object.freeze({
  "dependabot[bot]": { actorKind: "dependency" },
});

const GITHUB_ORG = process.env.SYMPHONY_REPOSITORY_OWNER || "example-org";
const HUMANS_TEAM_SLUG = "humans";
const AI_TEAM_SLUG = "ai";

export class GitHubTeamAccessError extends Error {
  constructor(message, { status, teamSlug } = {}) {
    super(message);
    this.name = "GitHubTeamAccessError";
    this.code = "missing_team_permission";
    this.status = status;
    this.teamSlug = teamSlug;
  }
}

export const normalize = (actor) =>
  String(actor || "")
    .trim()
    .toLowerCase();

const listContains = (logins, login) =>
  new Set((logins || []).map(normalize).filter(Boolean)).has(login);

const result = ({ login, classification, humanFacing, source, actorKind }) => ({
  login,
  classification,
  humanFacing,
  source,
  ...(actorKind ? { actorKind } : {}),
});

export const classifyGitHubActor = (actor, options = {}) => {
  const login = normalize(actor);
  const teamMembership = options.teamMembership || {};

  if (!login) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.UNKNOWN,
      humanFacing: false,
      source: "missing-login",
    });
  }

  if (listContains(options.humanAllowlist, login)) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.HUMAN,
      humanFacing: true,
      source: "human-allowlist",
    });
  }

  if (listContains(options.aiActorAllowlist, login)) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.AI_ACTOR,
      humanFacing: false,
      source: "ai-allowlist",
    });
  }

  if (listContains(options.dependencyBotAllowlist, login)) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.DEPENDENCY_BOT,
      humanFacing: false,
      source: "dependency-bot-allowlist",
      actorKind: "dependency",
    });
  }

  const knownDependency = KNOWN_DEPENDENCY_BOTS[login];
  if (knownDependency) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.DEPENDENCY_BOT,
      humanFacing: false,
      source: "known-dependency-bot",
      actorKind: knownDependency.actorKind,
    });
  }

  const knownAiActor = KNOWN_AI_ACTORS[login];
  if (knownAiActor) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.AI_ACTOR,
      humanFacing: false,
      source: "known-ai-actor",
      actorKind: knownAiActor.actorKind,
    });
  }

  if (teamMembership.ai) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.AI_ACTOR,
      humanFacing: false,
      source: "ai-team",
    });
  }

  if (teamMembership.humans) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.HUMAN,
      humanFacing: true,
      source: "humans-team",
    });
  }

  if (login.endsWith("[bot]")) {
    return result({
      login,
      classification: ACTOR_CLASSIFICATION.NON_HUMAN_BOT,
      humanFacing: false,
      source: "bot-suffix",
    });
  }

  return result({
    login,
    classification: ACTOR_CLASSIFICATION.UNKNOWN,
    humanFacing: true,
    source: "unknown-non-bot",
  });
};

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
};

export const githubTeamUrl = ({ org, teamSlug }) =>
  `https://api.github.com/orgs/${encodeURIComponent(
    org
  )}/teams/${encodeURIComponent(teamSlug)}`;

export const githubTeamMembershipUrl = ({ org, teamSlug, login }) =>
  `${githubTeamUrl({ org, teamSlug })}/memberships/${encodeURIComponent(
    login
  )}`;

const githubHeaders = (token) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  "x-github-api-version": "2022-11-28",
});

const ensureTeamReadable = async ({ org, teamSlug, token, fetchImpl }) => {
  const response = await fetchImpl(githubTeamUrl({ org, teamSlug }), {
    headers: githubHeaders(token),
  });
  if (response.ok) return;

  const payload = await safeJson(response);
  if ([401, 403, 404].includes(response.status)) {
    throw new GitHubTeamAccessError(
      `GitHub team "${teamSlug}" is not readable with the provided token (${response.status}).`,
      { status: response.status, teamSlug }
    );
  }
  throw new Error(
    `GitHub team read failed for "${teamSlug}" (${response.status}): ${
      payload.message || "unknown error"
    }`
  );
};

export const fetchGitHubTeamMembership = async ({
  actor,
  org = GITHUB_ORG,
  teamSlug,
  token,
  fetchImpl = fetch,
}) => {
  const login = normalize(actor);
  if (!login) throw new Error("GitHub actor login is required.");
  if (!token) {
    throw new GitHubTeamAccessError(
      "Set GH_TOKEN with GitHub org/team read access.",
      {
        teamSlug,
      }
    );
  }

  await ensureTeamReadable({ org, teamSlug, token, fetchImpl });

  const response = await fetchImpl(
    githubTeamMembershipUrl({ org, teamSlug, login }),
    { headers: githubHeaders(token) }
  );
  const payload = await safeJson(response);
  if (response.status === 200) {
    return payload.state === "active";
  }
  if (response.status === 404) {
    return false;
  }
  if ([401, 403].includes(response.status)) {
    throw new GitHubTeamAccessError(
      `GitHub team membership for "${teamSlug}" is not readable with the provided token (${response.status}).`,
      { status: response.status, teamSlug }
    );
  }
  throw new Error(
    `GitHub team membership read failed for "${teamSlug}" (${
      response.status
    }): ${payload.message || "unknown error"}`
  );
};

export const fetchGitHubActorTeams = async ({
  actor,
  org = GITHUB_ORG,
  humansTeamSlug = HUMANS_TEAM_SLUG,
  aiTeamSlug = AI_TEAM_SLUG,
  token,
  fetchImpl = fetch,
}) => {
  const [humans, ai] = await Promise.all([
    fetchGitHubTeamMembership({
      actor,
      org,
      teamSlug: humansTeamSlug,
      token,
      fetchImpl,
    }),
    fetchGitHubTeamMembership({
      actor,
      org,
      teamSlug: aiTeamSlug,
      token,
      fetchImpl,
    }),
  ]);

  return {
    status: "ok",
    org,
    humansTeamSlug,
    aiTeamSlug,
    membership: { humans, ai },
  };
};

export const classifyGitHubActorWithTeams = async (actor, options = {}) => {
  try {
    const teamLookup = await fetchGitHubActorTeams({ actor, ...options });
    return {
      ...classifyGitHubActor(actor, {
        ...options,
        teamMembership: teamLookup.membership,
      }),
      teamLookup,
    };
  } catch (error) {
    if (!(error instanceof GitHubTeamAccessError)) throw error;
    return {
      ...classifyGitHubActor(actor, options),
      teamLookup: {
        status: "missing_permission",
        code: error.code,
        statusCode: error.status,
        teamSlug: error.teamSlug,
        message: error.message,
      },
    };
  }
};

const parseArgs = (argv) => {
  let actor;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else if (arg.startsWith("-")) {
      throw new Error(`Unexpected argument: ${arg}`);
    } else if (!actor) {
      actor = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return { actor };
};

const usage = () =>
  [
    "Usage: node scripts/github-actor-classification.mjs <github-actor>",
    "",
    "Set GH_TOKEN with example-org org/team read access.",
  ].join("\n");

const main = async () => {
  const { actor, help } = parseArgs(process.argv.slice(2));
  if (help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!actor) throw new Error(usage());

  const classified = await classifyGitHubActorWithTeams(actor, {
    token: process.env.GH_TOKEN,
  });

  if (classified.teamLookup?.status === "missing_permission") {
    console.error(classified.teamLookup.message);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify(classified, null, 2)}\n`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
