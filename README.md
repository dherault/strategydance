# strategydance

An AI experiment.

A [Bun](https://bun.com) monorepo. Packages live under `packages/`.

## Packages

- [`packages/strategydance-web`](packages/strategydance-web) — TanStack Start (SPA mode) + React + Tailwind CSS v4, built with Vite
- [`packages/strategydance-database`](packages/strategydance-database) — the Firebase Data Connect service: the Postgres schema, its connectors, and the SDK generated from them
- [`packages/strategydance-core`](packages/strategydance-core) — types, enums and constants shared by every package, with zero runtime dependencies
- [`packages/strategydance-translations`](packages/strategydance-translations) — the Gemini-backed CLI that translates the message catalogues. Node-only

## Getting started

```sh
bun install
bun run dev
```

The frontend is served on http://localhost:5173.

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
| `bun run build` | Typechecks and builds the frontend |
| `bun run preview` | Serves the production build |
| `bun run lint` | Runs oxlint across the repo |
| `bun run lint:fix` | Runs oxlint with `--fix` |
| `bun run typecheck` | Runs `tsc` across the packages |
| `bun run test` | Runs `bun test` across the packages |
| `bun run translate` | Translates the message catalogues (needs a Gemini API key) |
| `bun run ncu` | Interactively updates dependencies |
