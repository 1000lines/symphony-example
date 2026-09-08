---
name: symphony-google-docs
description: Read required Google Docs through GOOGLE_APPLICATION_CREDENTIALS and scripts/fetch-google-doc.mjs; use for Google Doc source material and fail closed when access is missing.
---

# Symphony Google Docs

Use this skill when required source material links a Google Doc and
`GOOGLE_APPLICATION_CREDENTIALS` is available.

## Read Flow

1. Confirm `GOOGLE_APPLICATION_CREDENTIALS` is set in the local environment.
2. Read the document with the repo helper:

   ```bash
   node scripts/fetch-google-doc.mjs <google-doc-url-or-id>
   ```

3. If the URL includes `tab=...`, the helper reads that tab. To read every
   returned tab, pass the bare document URL or document id.
4. Use the helper output as source context before planning or implementation.

## Access Failure

If the helper cannot read the document because of authentication, sharing, API,
tab-read, or tooling failure, do not fall back to a personal Google identity or
manual snippets. Treat the document as unavailable source material.

For Symphony issue work, record the exact failed source and command in the
Linear workpad, ask a human to grant Viewer access to this service account, then
stop in the appropriate input-needed workflow state:

```text
example-doc-reader@example-project.iam.gserviceaccount.com
```
