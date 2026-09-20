# strategydance

An AI experiment.

A [Bun](https://bun.com) monorepo. Packages live under `packages/`.

## Packages

- [`packages/frontend`](packages/frontend) — TanStack Start (SPA mode) + React + Tailwind CSS v4, built with Vite

## Getting started

```sh
bun install
bun run dev
```

The frontend is served on http://localhost:5173.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Runs the frontend dev server |
| `bun run build` | Typechecks and builds the frontend |
| `bun run preview` | Serves the production build |
| `bun run lint` | Runs oxlint across the repo |
| `bun run lint:fix` | Runs oxlint with `--fix` |
| `bun run typecheck` | Runs `tsc` across the packages |
| `bun run ncu` | Interactively updates dependencies |
