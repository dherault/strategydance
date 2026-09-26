# strategydance

An AI experiment.

A [Bun](https://bun.com) monorepo. Packages live under `packages/`.

## Packages

- [`packages/strategydance-web`](packages/strategydance-web) — TanStack Start (SPA mode) + React + Tailwind CSS v4, built with Vite
- [`packages/strategydance-database`](packages/strategydance-database) — the Firebase Data Connect service: the Postgres schema, its connectors, and the SDK generated from them
- [`packages/strategydance-core`](packages/strategydance-core) — types, enums and constants shared by every package, with zero runtime dependencies
- [`packages/strategydance-design-system`](packages/strategydance-design-system) — the component library: shadcn + Tailwind CSS v4, documented in Storybook
- [`packages/strategydance-translations`](packages/strategydance-translations) — the Gemini-backed CLI that translates the message catalogues. Node-only
- [`packages/strategydance-emails`](packages/strategydance-emails) — the transactional emails, as React Email templates the backend renders. Node-only
- [`packages/strategydance-backend`](packages/strategydance-backend) — a Bun and Express server on Cloud Run, for what needs a secret or the server's word, like inviting people

## Getting started

```sh
bun install
bun run dev:emulators
bun run dev:backend
bun run dev
```

Each in its own terminal. The frontend is served on http://localhost:5173 and the backend on
http://localhost:3003, both against the Firebase emulators.

## Translations

The interface is localized with [React Intl](https://formatjs.io/docs/react-intl/) into English,
French, Spanish, German, Portuguese, Chinese and Japanese. English is the source: its strings are
the `defaultMessage`s in `packages/strategydance-web/src/data/intl/messages/`, so it has no catalogue of its
own.

`bun run translate` fills the other six from those sources with Gemini, and only sends what has
actually changed. It needs a key in `packages/strategydance-translations/.env` (see `.env.example`)
and it spends quota on every run, so it is run by hand rather than in CI.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Runs the frontend dev server |
| `bun run dev:emulators` | Runs the Firebase emulators |
| `bun run dev:backend` | Runs the backend against the emulators |
| `bun run dev:emails` | Runs React Email's preview server on the email templates |
| `bun run build` | Typechecks and builds the design system's Storybook and the frontend |
| `bun run storybook` | Runs the design system's Storybook |
| `bun run preview` | Serves the production build |
| `bun run lint` | Runs oxlint across the repo |
| `bun run lint:fix` | Runs oxlint with `--fix` |
| `bun run typecheck` | Runs `tsc` across the packages |
| `bun run test` | Runs `bun test` across the packages |
| `bun run translate` | Translates the message catalogues (needs a Gemini API key) |
| `bun run ncu` | Interactively updates dependencies |
| `bun run ship` | Opens the release pull request, from `dev` to `main` |
| `bun run deploy:backend` | Deploys the backend to Cloud Run |
