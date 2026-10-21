# Design sync notes

What a sync of this repository needs to know, read before anything else. The plan and the
milestones are in [documents/design-sync.md](../documents/design-sync.md).

## Running it

- Run everything from the repository root of the campaign worktree, `.claude/worktrees/design-sync`
- `bun .design-sync/buildPackage.ts` first, always (the config's `buildCmd`), then the converter:

  ```sh
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules packages/strategydance-design-system/node_modules --out ./ds-bundle
  node .ds-sync/package-validate.mjs ./ds-bundle
  ```

- The reference Storybook is built from the package's directory:
  `bunx storybook build -c .storybook -o <worktree>/.design-sync/sb-reference`, about four minutes.
  Rebuild it whenever a story or a component changes, together with the converter's build
- A full converter build takes about 25 minutes, nearly all of it compiling the 43 previews one at a
  time. Use `preview-rebuild.mjs --components <Name>` to iterate on one

## Fixes

- [GENERAL] No `dist/`, no root export, no `.d.ts`: the converter found no components (`exported
  PascalCase symbols: 0`, `[TITLE_UNMAPPED]` for all 43) -> it reads a package's exports from the
  `.d.ts` tree its `package.json` `types` leads to, and the design system ships TypeScript source
  -> `buildPackage.ts` builds a stand-in package under
  `packages/strategydance-design-system/node_modules/.cache/design-sync/`, named
  `strategydance-design-system`: `entry.ts` re-exporting every component module but the editor's
  own parts, `types/` emitted by `tsc`, and `styles/`. The config's `entry` points at it, and the
  converter takes the stand-in for the package, since it walks up from the entry to the first
  `package.json` with a name. Package-relative config paths (`tsconfig`, `cssEntry`) are relative
  to the stand-in
- [GENERAL] `react not found under --node-modules` with the root `node_modules` -> Bun installs
  each workspace package's dependencies into its own `node_modules`, linked into
  `node_modules/.bun/` -> `--node-modules packages/strategydance-design-system/node_modules`
- [GENERAL] tsc reports TS2883, a type it cannot name portably through Bun's store, for four
  modules of `src/lib/` and writes their declarations anyway -> `buildPackage.ts` tolerates TS2883
  outside `src/components/` and fails on anything else
- [GENERAL] `styles.css` carried only `_ds_bundle.css`, the CSS the components import (BlockNote's
  and the editor's), and none of Tailwind's: the Storybook fallback only fires when the bundle's
  CSS is missing or a stub -> `buildPackage.ts` builds `src/index.css` with Vite and the design
  system's own Tailwind plugin, from the design system's root, into `styles/styles.css` with the
  fonts beside it under their own names, and the config's `cssEntry` appends it. It matches
  Storybook's compiled CSS byte for byte but the fonts' addresses (118.8 KB against 119.0 KB)
- Story imports: `strategydance-design-system/components/<path>/<Name>` resolves to the shipped
  global when `<Name>` is an exported component, by the converter's own rule. An import of
  `strategydance-design-system/lib/*` or `hooks/*` is bundled into the preview instead
