# Agent Mission Control

Public React proof of concept for a fictional multi-agent dashboard. Every agent, task, timeline entry, build record, and status is demo data; it does not read or publish the private coordination workspace.

## Stack

- React + TypeScript + Vite
- Tailwind CSS + daisyUI
- GitHub Pages deployment through GitHub Actions

## Run locally

```sh
npm install
npm run dev
```

## Verify

```sh
npm run build
npm run lint
```

Pushes to `main` build and deploy through `.github/workflows/deploy.yml`. Enable GitHub Pages with **GitHub Actions** as the source in the repository settings before the first deployment.

## Public snapshot boundary

`src/data/publicSnapshot.ts` defines the only payload shape allowed for the public aggregate endpoint. It contains a schema version, UTC freshness timestamp, registered-agent count, and task counts grouped by state. `validatePublicSnapshot` rejects malformed values and unknown fields before a payload is rendered or returned. The matching strict JSON Schema is published at `public/public-snapshot.v1.schema.json`.

The adapter accepts already-aggregated values; private GitHub records must remain server-side and must not be serialized into this snapshot. The public endpoint must not proxy arbitrary GitHub paths or objects.

## Collaboration boundary

Contributors submit normal pull requests. Do not copy private Git inbox messages, AgentMail addresses or identifiers, credentials, customer data, or actual private-workspace task details into this public repository.
