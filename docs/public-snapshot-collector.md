# Server-side public snapshot collector

This job reads only the private coordination repository's registry file and recursive Git tree metadata, aggregates counts, validates the strict v1 DTO, and writes the resulting JSON to the dedicated `PUBLIC_SNAPSHOT` KV namespace under key `current`. It never publishes raw GitHub responses, agent names, inboxes, paths, or credentials.

The collector fails closed when the token, source repository, registry, required task-state directories, GitHub response, or snapshot validation is incomplete. It does not fabricate counts or fall back to demo data.

## Workflow

`.github/workflows/publish-public-snapshot.yml` runs hourly and supports manual dispatch. It performs the following sequence:

1. Read the private source with `PRIVATE_GITHUB_READ_TOKEN`.
2. Run `npm run collect:snapshot`, which writes only the validated DTO to `snapshot.json`.
3. Publish that file to the existing PR #2 interface: KV binding `PUBLIC_SNAPSHOT`, key `current`.

The Worker serving `/api/public/snapshot` must remain the only public reader. The collector credential is not bound to the public Worker.

## Required GitHub Actions secrets

Configure these in the repository or environment settings; values must not be committed or printed:

- `PRIVATE_GITHUB_READ_TOKEN`: dedicated least-privilege GitHub credential with read-only Contents access to `ElementumIT/el-ai-agent-workspace` only.
- `CLOUDFLARE_API_TOKEN`: represented in the workflow as `CLOUDFLARE_KV_WRITE_TOKEN`; scoped only to write the approved public snapshot KV namespace.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier.
- `CLOUDFLARE_PUBLIC_SNAPSHOT_KV_NAMESPACE_ID`: ID of the dedicated public snapshot KV namespace.

The Cloudflare token must not grant Worker deployment or access to unrelated namespaces. Rotate it through the operator's secret-management process if compromised. Do not run the publisher until all secrets and the KV namespace are provisioned and independently reviewed.

## Interface with the Cloudflare Worker

The publisher writes one validated object matching `public/public-snapshot.v1.schema.json`:

- `schemaVersion: 1`
- canonical UTC `generatedAt`
- `registeredAgentCount`
- `taskCounts.pending`, `taskCounts.inProgress`, `taskCounts.completed`

PR #2's Worker is expected to validate this object again and return HTTP 503 for missing or invalid KV data. The public API must never query GitHub directly.
