---
name: symphony-linear-api
description: Access Linear GraphQL and Linear-hosted uploads or attachments with LINEAR_API_KEY; use when direct Linear API access or downloads are needed.
---

# Symphony Linear API

Use this skill when `LINEAR_API_KEY` is available and the task needs to read
Linear through GraphQL or download a Linear-hosted upload or attachment.

Do not print, commit, or paste the token. For Symphony issue work, prefer the
injected `linear_graphql` tool when it is available; use direct API access when
you have the key and injected tooling is unavailable or not functioning.

## GraphQL

Confirm `LINEAR_API_KEY` is set, then call the GraphQL endpoint with the token
as the authorization header:

```bash
curl -fsS \
  -H "content-type: application/json" \
  -H "Authorization: ${LINEAR_API_KEY}" \
  --data '{"query":"query SymphonyViewer { viewer { id name email } }"}' \
  https://api.linear.app/graphql
```

Replace the query body with the smallest GraphQL query needed for the task.
When Symphony's injected `linear_graphql` tool is available, prefer it for
Linear issue reads and writes inside the agent workflow.

## Uploads

Download Linear-hosted upload or attachment URLs with the same token:

```bash
curl -fsSL \
  -H "Authorization: $LINEAR_API_KEY" \
  "https://uploads.linear.app/<workspace>/<attachment>/<file>" \
  -o <local-output-file>
```

Use a descriptive local output filename, keep downloaded source files out of
commits unless the ticket explicitly asks to add them, and record access
failures as unavailable source material in the Linear workpad.
