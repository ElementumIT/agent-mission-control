# Task 0005: Cloudflare deployment staging

This branch introduces a **public-only, fail-closed Worker foundation**. It does not implement GitHub OAuth or publish real data yet. Keep GitHub Pages live.

1. Create a Cloudflare KV namespace dedicated to **approved public snapshots**. Put its namespace ID in `wrangler.jsonc` before deployment. Do not place private GitHub credentials in this Worker.
2. Set Vite's production base path to `/` in a separate reviewed change for Cloudflare. Do not switch the existing GitHub Pages production build until the new deployment is ready.
3. Deploy a preview Worker with Wrangler using your own authenticated Cloudflare account. Use the Cloudflare static-assets binding and the Worker entrypoint in `wrangler.jsonc`.
4. Populate KV key `current` only with the strict v1 snapshot validated by `validatePublicSnapshot`. Never copy raw GitHub JSON into KV. A separate server-side collector with read-only GitHub access will generate the approved snapshot.
5. Verify that `/api/public/snapshot` returns HTTP 503 when no snapshot exists, HTTP 200 for valid data, and HTTP 503 for invalid data. Verify `/api/private/overview` and `/app` return HTTP 401.
6. Do not deploy private data or claim GitHub authentication works. Those require a separate authenticated Worker/service with user allowlisting, session storage, and security tests.

This design deliberately keeps the public Worker free of private GitHub credentials. Do not bind a private GitHub token to the public snapshot-serving Worker when adding the collector.
