# Repository configuration

`.symphony.cfg.json` lives in the repository root. Read it from the selected base
commit and record that SHA. Changes on a task branch are proposals until merged.
It contains repository development settings, never secrets, App installation
IDs, Linear IDs, repository allowlists, or controller dispatch destinations.
Discover identities through GitHub and the assigned Linear project at runtime.

```json
{
  "schemaVersion": "symphony-repository/v1",
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
