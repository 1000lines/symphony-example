# GitHub Actor Classification

`scripts/github-actor-classification.mjs` classifies GitHub actor logins for
Symphony review and rework workflows. It is a dependency-free bare-node helper
so local Symphony runs and GitHub runners can use the same contract without an
install or build step.

This helper owns classification only. It does not trigger workflows, update
Linear, post PR reviews, or decide Cadence review behavior.

## Inputs

The pure classifier accepts a GitHub actor login and optional local context:

- `humanAllowlist`: explicit human login overrides.
- `aiActorAllowlist`: explicit AI actor login overrides.
- `dependencyBotAllowlist`: explicit dependency bot login overrides.
- `teamMembership.humans`: pre-resolved membership in the GitHub `humans` team.
- `teamMembership.ai`: pre-resolved membership in the GitHub `ai` team.

Set `SYMPHONY_BOT_USER` and `CADENCE_REVIEWER` before loading the helper;
workflows read the matching repository variables. Login comparisons normalize
case. The known actor roles and synthetic fallback identities are:

- `example-symphony-bot`: AI actor with `actorKind: "coding"`.
- `example-cadence-bot`: AI actor with `actorKind: "review"`.
- `claude[bot]`: AI coding actor, not a review authority.
- `dependabot[bot]`: dependency bot.

## Rule Precedence

The classifier applies the most explicit local signals before team and suffix
fallbacks: human allowlist, AI allowlist, dependency-bot allowlist, known
dependency bots, known AI actors, `ai` team membership, `humans` team
membership, `[bot]` suffix, then unknown non-bot fallback. If both `ai` and
`humans` team membership are true for the same login, `ai` wins.

`classifyGitHubActorWithTeams` still attempts the GitHub team lookup before
classification so callers can see whether authoritative team membership was
read. After lookup, the same precedence applies, so a known AI actor is not
promoted to human even if team membership data also says `humans: true`.

## Output

The helper returns JSON with:

- `login`: normalized lowercase login.
- `classification`: one of `human`, `ai_actor`, `dependency_bot`,
  `non_human_bot`, or `unknown`.
- `humanFacing`: `true` when downstream safety behavior should treat the actor
  as human-facing.
- `source`: the rule that classified the actor.
- `actorKind`: present for known project actors as `coding`, `review`, or
  `dependency`.

Unknown non-bot actors return `classification: "unknown"` with
`humanFacing: true`. This keeps unknown outside contributors human-facing until
the GitHub teams or explicit allowlists say otherwise.

Unknown actors ending in `[bot]` return `classification: "non_human_bot"` with
`humanFacing: false`. Bot suffixes are never treated as humans by default.

## GitHub Team Lookup

The CLI resolves membership in the `humans` and `ai` teams of the organization
selected by `SYMPHONY_REPOSITORY_OWNER` before classification. Set this to your
GitHub organization; the `example-org` fallback is a synthetic placeholder.

```sh
node scripts/github-actor-classification.mjs <github-actor>
```

Environment:

- `GH_TOKEN`: GitHub token with organization/team read access.

The API path first checks that each team is readable, then checks actor
membership. A readable team plus 404 membership means "not a member." A 401,
403, or unreadable team is reported as:

```json
{
  "teamLookup": {
    "status": "missing_permission",
    "code": "missing_team_permission"
  }
}
```

When `classifyGitHubActorWithTeams` returns `status: "missing_permission"`, the
local fallback classification is included only so callers can record safe
blocker context. It is not authoritative for workflows that require GitHub team
truth. Those workflows should record the credential blocker instead of treating
bots as humans or proceeding as if team membership was read.

The CLI has no local-only mode. If team lookup is missing permission, it exits
non-zero and does not print a classification JSON payload.

The helper does not print tokens, request headers, or secret values. CLI output
is JSON; the CLI exits with code `2` when team lookup is missing permission.

## Examples

Pure ESM use:

```js
import { classifyGitHubActor } from "./scripts/github-actor-classification.mjs";

const actor = classifyGitHubActor("new-contributor");
```

`new-contributor` returns `unknown` and `humanFacing: true` until a team lookup
or explicit allowlist provides a more authoritative classification.
