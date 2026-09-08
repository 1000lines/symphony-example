import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTOR_CLASSIFICATION,
  classifyGitHubActor,
  classifyGitHubActorWithTeams,
} from "./github-actor-classification.mjs";

test("classifies a humans-team member as human", () => {
  assert.deepEqual(
    classifyGitHubActor("Example-Human", { teamMembership: { humans: true } }),
    {
      login: "example-human",
      classification: ACTOR_CLASSIFICATION.HUMAN,
      humanFacing: true,
      source: "humans-team",
    }
  );
});

test("classifies an ai-team member as an AI actor", () => {
  assert.deepEqual(
    classifyGitHubActor("ai-person", { teamMembership: { ai: true } }),
    {
      login: "ai-person",
      classification: ACTOR_CLASSIFICATION.AI_ACTOR,
      humanFacing: false,
      source: "ai-team",
    }
  );
});

test("uses explicit allowlists before fallback suffix rules", () => {
  assert.deepEqual(
    classifyGitHubActor("trusted-service[bot]", {
      humanAllowlist: ["trusted-service[bot]"],
    }),
    {
      login: "trusted-service[bot]",
      classification: ACTOR_CLASSIFICATION.HUMAN,
      humanFacing: true,
      source: "human-allowlist",
    }
  );

  assert.deepEqual(
    classifyGitHubActor("renovate[bot]", {
      dependencyBotAllowlist: ["renovate[bot]"],
    }),
    {
      login: "renovate[bot]",
      classification: ACTOR_CLASSIFICATION.DEPENDENCY_BOT,
      humanFacing: false,
      source: "dependency-bot-allowlist",
      actorKind: "dependency",
    }
  );
});

test("classifies known Symphony and Cadence bot accounts as AI actors", () => {
  assert.deepEqual(classifyGitHubActor("example-symphony-bot"), {
    login: "example-symphony-bot",
    classification: ACTOR_CLASSIFICATION.AI_ACTOR,
    humanFacing: false,
    source: "known-ai-actor",
    actorKind: "coding",
  });

  assert.deepEqual(classifyGitHubActor("example-cadence-bot"), {
    login: "example-cadence-bot",
    classification: ACTOR_CLASSIFICATION.AI_ACTOR,
    humanFacing: false,
    source: "known-ai-actor",
    actorKind: "review",
  });
});

test("classifies claude[bot] as a known AI coding actor", () => {
  assert.deepEqual(classifyGitHubActor("claude[bot]"), {
    login: "claude[bot]",
    classification: ACTOR_CLASSIFICATION.AI_ACTOR,
    humanFacing: false,
    source: "known-ai-actor",
    actorKind: "coding",
  });
});

test("classifies dependabot[bot] as a dependency bot", () => {
  assert.deepEqual(classifyGitHubActor("dependabot[bot]"), {
    login: "dependabot[bot]",
    classification: ACTOR_CLASSIFICATION.DEPENDENCY_BOT,
    humanFacing: false,
    source: "known-dependency-bot",
    actorKind: "dependency",
  });
});

test("classifies an unknown non-bot actor as human-facing for safety", () => {
  assert.deepEqual(classifyGitHubActor("new-contributor"), {
    login: "new-contributor",
    classification: ACTOR_CLASSIFICATION.UNKNOWN,
    humanFacing: true,
    source: "unknown-non-bot",
  });
});

test("classifies an unknown [bot] actor as non-human", () => {
  assert.deepEqual(classifyGitHubActor("third-party[bot]"), {
    login: "third-party[bot]",
    classification: ACTOR_CLASSIFICATION.NON_HUMAN_BOT,
    humanFacing: false,
    source: "bot-suffix",
  });
});

test("GitHub lookup can resolve humans-team membership", async () => {
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/teams/humans") || pathname.endsWith("/teams/ai")) {
      return new Response(JSON.stringify({ slug: pathname.split("/").pop() }), {
        status: 200,
      });
    }
    if (pathname.endsWith("/teams/humans/memberships/example-human")) {
      return new Response(JSON.stringify({ state: "active" }), { status: 200 });
    }
    if (pathname.endsWith("/teams/ai/memberships/example-human")) {
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const classified = await classifyGitHubActorWithTeams("example-human", {
    token: "test-token",
    fetchImpl,
  });

  assert.equal(classified.classification, ACTOR_CLASSIFICATION.HUMAN);
  assert.equal(classified.source, "humans-team");
  assert.equal(classified.teamLookup.status, "ok");
  assert.deepEqual(classified.teamLookup.membership, {
    humans: true,
    ai: false,
  });
});

test("missing team permission is surfaced and does not make a bot human", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ message: "Requires org read permission" }), {
      status: 403,
    });

  const classified = await classifyGitHubActorWithTeams("third-party[bot]", {
    token: "secret-token",
    fetchImpl,
  });

  assert.equal(classified.classification, ACTOR_CLASSIFICATION.NON_HUMAN_BOT);
  assert.equal(classified.humanFacing, false);
  assert.equal(classified.teamLookup.status, "missing_permission");
  assert.equal(classified.teamLookup.code, "missing_team_permission");
  assert.doesNotMatch(JSON.stringify(classified), /secret-token/);
});
