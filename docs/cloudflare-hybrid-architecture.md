# Task 0005 — Cloudflare Worker architecture and security plan

## Deployment target

Use a single Cloudflare Worker with static assets for the React/Vite application and API endpoints. Keep the current GitHub Pages site active until the owner verifies the Cloudflare deployment and the user approves retirement.

Vite's current `base: '/agent-mission-control/'` is GitHub Pages-specific. In the Cloudflare build, change the base to `/` and use a SPA fallback for frontend routes. Remove the Pages deployment workflow only after cutover; do not expose private data through static files.

## Routes and trust boundaries

| Route | Authorization | Behavior |
| --- | --- | --- |
| `/` | Public | Render real aggregate snapshot only |
| `/api/public/snapshot` | Public | Return validated allowlisted JSON snapshot; no arbitrary query of private GitHub |
| `/login` | Public | Start GitHub OAuth with state + PKCE where supported |
| `/auth/callback` | OAuth transaction | Validate state, exchange code server-side, resolve GitHub user identity, enforce allowlist |
| `/app` | Authorized session | Private dashboard shell |
| `/api/private/overview` | Authorized session | Read-only, server-side GitHub-backed overview |
| `/logout` | Session | Clear server-side session and cookie |

Protect both `/app` and `/api/private/*` at the Worker layer. A client-side route guard is not sufficient. If using a SPA fallback, do not return private serialized data in the public HTML or assets.

## Public snapshot pipeline

The collector runs server-side with read-only GitHub access and aggregates registry/task state before constructing the payload. The public response is a separately validated DTO from `src/data/publicSnapshot.ts`, not a redacted GitHub API response. Reject unknown keys. Public output initially includes only schemaVersion, generatedAt, registeredAgentCount, and taskCounts (pending, inProgress, completed). Do not publish agent display names until the user approves a fixed list.

Prefer generating the snapshot into a dedicated public KV record or other separate store with only validated fields. The public handler should have access only to that snapshot, not the private GitHub token. Separate Worker bindings/services if needed to enforce this boundary. Use stale-data indicators, no fake 'online' status, and do not substitute fictional values on API errors.

## GitHub authentication

- Register a GitHub OAuth App with the precise Cloudflare callback URL; do not place the client secret in Git or frontend environment variables.
- Store OAuth client secret, session-signing/encryption key, and GitHub read token as Cloudflare secrets.
- Authenticate with a cryptographically random state bound to an HttpOnly, Secure, SameSite=Lax short-lived cookie; use PKCE if supported by the selected OAuth flow.
- Exchange authorization code server-side; fetch the authenticated user's stable GitHub numeric ID and enforce a fixed allowlist of IDs, not merely organization membership or mutable usernames.
- Issue an opaque session ID in an HttpOnly, Secure, SameSite=Lax cookie. Store session data server-side with expiration and revocation; rotate on login. Do not expose OAuth access tokens to the browser.
- Require CSRF protection for session-changing routes. Restrict CORS to same origin; no wildcard credentialed CORS.
- Return 401/403 from private APIs as appropriate, with Cache-Control: no-store. Rate-limit login/callback and avoid logging secrets or raw private responses.

## Data permissions

Start read-only. Private data can include agent registry, task owners and states, Issues/PR summaries, and recent Git activity, with per-source freshness. AgentMail bodies and addresses are excluded from both initial views. Git commits are not evidence of an agent currently being online.

## Verification gates

1. `npm run build`, lint and automated snapshot tests pass.
2. Public API rejects unexpected keys and serves no private source records.
3. Unauthenticated and unauthorized users cannot retrieve private routes or APIs; authorized GitHub identity succeeds.
4. Public static assets contain no GitHub tokens, private repository data, AgentMail addresses, host paths, or client secrets.
5. Cloudflare URL and OAuth callback work in production; smoke test desktop/mobile.
6. Owner records deployment evidence and obtains user approval before disabling GitHub Pages.

## Implementation ownership

CodexLenovo: Worker shell, GitHub OAuth/session/authz, frontend integration, CI/deployment, final review and closure.

HermesMinisforum: strict snapshot contract, tests, server-side aggregation adapter; PR reviewed by CodexLenovo.

**No Cloudflare credentials or OAuth secrets are required to review this plan.** Deployment and live OAuth verification require the user's authorized Cloudflare and GitHub configuration.
