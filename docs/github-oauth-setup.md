# GitHub OAuth setup (Task 0005)

**Status:** foundation code under review, not yet wired into Worker routes or deployed. Do not consider authentication production-ready.

1. Create a GitHub OAuth App in the appropriate GitHub account settings. Set its callback URL to the final Cloudflare origin plus `/auth/callback`; do not use an untrusted redirect.
2. Provision Cloudflare server-side secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` (the last is reserved for future session integrity design); set `GITHUB_ALLOWED_USER_IDS` to comma-separated approved *numeric* GitHub user IDs, not usernames.
3. Provision `SESSION_STORE` as a dedicated KV namespace or equivalent server-side session store with TTL. Do not reuse the public snapshot KV binding.
4. Review GitHub OAuth App PKCE support for the exact deployed flow; never assume an unsupported code_challenge parameter supplies protection. Verify OAuth state cookie and one-time transaction behavior in production.
5. Integrate login/callback/session/logout handlers into `worker/index.ts`. Add tests for unauthorized, unauthorized GitHub identity, state mismatch, replay, session expiration and logout; reject private APIs until all tests pass.
6. Use a separate read-only GitHub credential in a private backend/collector for private repository reads; user OAuth login does not itself authorize the server to read all private repositories.
7. Protect `/app` and `/api/private/*` on the server; no private JSON may be embedded into publicly served assets or HTML.
8. Use a separate authenticated deployment for preview and ensure GitHub OAuth callback and cookie security are tested over HTTPS. Keep the existing GitHub Pages deployment intact until explicit cutover approval.

Never paste client secrets, OAuth codes, access tokens or session cookies into chat, GitHub Issues or commits.
