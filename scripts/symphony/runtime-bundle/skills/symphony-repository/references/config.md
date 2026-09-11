# Repository configuration

`.symphony.cfg.json` lives in the repository root. Read it from the selected base
commit and record that SHA. Changes on a task branch are proposals until merged.
It contains repository development settings, never secrets, App installation
IDs, Linear IDs, repository allowlists, or controller dispatch destinations.
The required `linear.teamKey` selects the repository's Linear team. Discover
numeric and UUID identities through GitHub and Linear at runtime.

```json
{
  "schemaVersion": "symphony-repository/v1",
  "linear": { "teamKey": "ENG" },
  "workingDirectory": ".",
  "instructions": ["AGENTS.md"],
  "commands": {
    "setup": [["npm", "ci"]],
    "build": [["npm", "run", "build"]],
    "test": [["npm", "test"]],
    "lint": [["npm", "run", "lint"]]
  },
  "ci": {
    "requiredChecks": [
      {
        "name": "CI Required",
        "workflow": ".github/workflows/ci.yml",
        "appId": 15368
      }
    ]
  }
}
```

This is an illustrative Node configuration, not a default for other repositories.
Every repository must specify its own `linear.teamKey` as an uppercase string
(for example, `"100"` or `"ENG"`). Ticket routing reads the file at that checkout's
Git root, even when the helper lives in another repository or runs from a
subdirectory. Missing or invalid configuration is an error; there is no fallback
to a controller's `WORKFLOW.md`, another checkout, or an inferred team.
Only include instruction files that exist. Each command is an executable and
its arguments; multiple commands run in order. These are instructions for the
worker, not shell expressions executed by the config reader. Use the target's
existing scripts for complex commands. Omit unsupported command categories or
use an empty list. Paths are relative to the repository root, stay inside it,
and must not follow symlinks outside the workspace when used.

`ci.requiredChecks` identifies observed check names, workflow files and producing
GitHub App IDs. Evaluate them against the current task head and actual results;
a check with the same name from a different workflow or App is not equivalent.
Repository branch rules may impose additional checks; this file does not waive
them. If no checks are known, an empty list is a valid onboarding proposal, but
must be called out for human review and must never be reported as passing CI.

The file does not select the target repository or its base branch. Those come
from the assigned task/project and GitHub's default branch. The host's identity,
review controller and operational limits remain deployment settings. A new
repository must not redirect privileged review jobs or request private keys.

If config cannot be proposed in a PR, include this same JSON in a GitHub issue
or the pinned Linear workpad, with the desired path and the observed limitation.

## Validation modes and portable commands

Only optional `ci.mode` is added: `native`, `docker`, or `remote`. Omitting it
leaves the config unchanged and preserves native-first behavior. Native uses
installed tools, with Docker fallback for environment gaps. Docker runs the
client's image-build and container commands. Remote runs available checks,
records missing tools/unrun checks and publishes the prepared head to GitHub CI
without installing toolchains or requiring Docker. Known failed assertions must
be fixed in every mode. All modes require actual current-head GitHub CI.

Keep `linear.teamKey` alone. A repository has no `projectKey` or project filter;
project identity and metadata come from each issue. Different issue/project
contexts can use exactly the same repository configuration.

A shell command is **one argument** after `bash`, `-lc`. Serialize the complete
array with `JSON.stringify(["bash", "-lc", command])`, preserving quotes,
newlines, pipelines and shell substitutions instead of splitting on spaces:

```json
{
  "build": [["bash", "-lc", "make build && printf '%s\\n' \"build complete\""]],
  "test": [["bash", "-lc", "make test"]]
}
```

Docker is expressed through those same arrays, with no separate Docker schema
or mode dispatcher. For example, these commands build a client-supplied root
Dockerfile and run checks in its image. The worker substitutes its own task-local
image name, records `docker image inspect` output, and uses that digest in the
run command. Run from the issue workspace root so the mount stays isolated.

```json
{
  "setup": [["docker", "build", "-t", "client-template-ci-DEMO-123", "."]],
  "test": [
    [
      "bash",
      "-lc",
      "docker run --rm --user \"$(id -u):$(id -g)\" --mount \"type=bind,src=$PWD,dst=/workspace\" --workdir /workspace \"$(docker image inspect --format '{{.Id}}' client-template-ci-DEMO-123)\" bash -lc 'make build && make test'"
    ]
  ]
}
```

Avoid published ports and remove only task containers. The config reader never
executes commands; the worker and optional secret-free client command workflow
use executable/argument arrays. Existing application CI remains the preferred
GitHub validation surface. Discover its check names, workflow paths and emitting
Apps; never copy seed check names or count the advisory Cadence review as CI.
