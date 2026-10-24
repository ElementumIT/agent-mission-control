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

## Collaboration boundary

Contributors submit normal pull requests. Do not copy private Git inbox messages, AgentMail addresses or identifiers, credentials, customer data, or actual private-workspace task details into this public repository.
