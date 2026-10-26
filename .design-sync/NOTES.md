# Design sync notes

What a sync of this repository needs to know, read before anything else. The plan and the
milestones are in [documents/design-sync.md](../documents/design-sync.md).

## Running it

- Run everything from the root of the checkout that syncs, any of them since M4 put the record in
  the project
- A checkout that has never synced needs the skill's scripts in `.ds-sync/`, which `/design-sync`
  stages and the main checkout on David's machine has kept since M4, with their dependencies:
  `(cd .ds-sync && npm i esbuild ts-morph @types/react playwright && npx playwright install
  chromium)`. Then the reference Storybook, below. `checkNames.ts` needs them too, since it reads
  declarations with `.ds-sync/`'s ts-morph
- `bun .design-sync/buildPackage.ts` first, always (the config's `buildCmd`), then the converter:

  ```sh
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules packages/strategydance-design-system/node_modules --out ./ds-bundle
  node .ds-sync/package-validate.mjs ./ds-bundle
  ```

- Then the name check, which exits 1 on any name the props, the usage notes or the conventions give
  that the build does not have: `bun .design-sync/checkNames.ts`. While writing a note,
  `--only <Name,…> --props <dir>` checks those components' drafts, `<dir>/<Name>.txt` each, before
  they reach the config
- Then the examples, which nothing else runs: `bun .design-sync/runExamples.ts`, every ```jsx block
  of the notes and the conventions as written, in a page loading the upload, failing on one that
  does not compile, throws, logs an error or draws nothing. A minute and a half; its screenshots
  land in `ds-bundle/_screenshots/examples/`
- The closing check is the skill's driver, against the project's record: fetch `_ds_sync.json`
  with `DesignSync(get_file)` into `.design-sync/.cache/remote-sync.json`, then

  ```sh
  node .ds-sync/resync.mjs --config .design-sync/config.json \
    --node-modules packages/strategydance-design-system/node_modules --out ./ds-bundle --max-stories 11 \
    --remote .design-sync/.cache/remote-sync.json
  ```

  It runs no `buildCmd`: run `buildPackage.ts` first. Fetch the record again right before the
  upload's `finalize_plan`: if it moved, another sync ran meanwhile, and the driver runs again
- The reference Storybook is built from the package's directory:
  `bunx storybook build -c .storybook -o <checkout>/.design-sync/sb-reference`, about four minutes.
  Rebuild it whenever a story or a component changes, together with the converter's build
- A full converter build takes 15 to 25 minutes, nearly all of it compiling the 44 previews one at
  a time. Use `preview-rebuild.mjs --components <Name>` to iterate on one, a few seconds

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
  fonts beside it under their own names, and the config's `cssEntry` appends it. It matched
  Storybook's compiled CSS byte for byte but the fonts' addresses (118.8 KB against 119.0 KB),
  until M3 added the layout vocabulary to it (below)
- Story imports: `strategydance-design-system/components/<path>/<Name>` resolves to the shipped
  global when `<Name>` is an exported component, by the converter's own rule. An import of
  `strategydance-design-system/lib/*` or `hooks/*` is bundled into the preview instead
- [GENERAL] Overlays graded against nothing: the harness photographs Storybook's `#storybook-root`
  alone, and an open overlay portals to the body, outside it, so the reference of Dialog's Open
  story is the trigger under a backdrop, while the preview's shot is the whole viewport. The same
  holds for any story taller than the viewport (Markdown's Page, Dock and Past Bound): the
  reference is the whole element, the preview the viewport -> `bun .design-sync/captureStorybook.ts
  <Name>…` writes Storybook's viewport, at the harness's size and stabilization, beside the raw
  shots as `…__sb-viewport.png`. Grade such a story against it. `cmp` tells a byte-identical pair at
  once
- [GENERAL] Calendar's In Dialog and RichText's Unreadable came out `sb-error`, "no storybook root
  content", though Storybook renders both -> the harness waits for content in `#storybook-root`,
  and In Dialog opens its dialog from the start, with no trigger, so everything portals to the
  body, while RichText draws nothing for a value it cannot read, by design. The harness then takes
  no preview shot either -> `captureStorybook.ts` waits for `body.sb-show-main`, which Storybook
  sets once a story has rendered, empty or not, and shoots them; the preview's side is its card's
  `?story=<Export>` page shot at 900x700 with the harness's stabilization. Both graded `match`
  with `"basis": "manual-capture"`, which compare carries forward. The new wait left the 26 shots
  it had taken before byte-identical
- [GENERAL] CitationLink's reference cut the top off its raised bubble -> anything drawn outside
  `#storybook-root`'s box is outside the harness's shot, upward as much as outward: a superscript,
  a negative margin, a shadow or a ring -> grade such a story against `captureStorybook.ts`'s
  viewport too
- Grading a small story: the harness's `__sb.png` is the root alone, 868px wide and as tall as the
  story, the `__ds.png` the 900x700 viewport -> crop the `__ds.png` at +24+24 to the `__sb.png`'s
  size, stack the two and enlarge them 3 to 5 times (`magick … -scale`), and a 1px border or a
  colour shows
- Sidebar: the footer cut off below the viewport, then the panel 24px off the edge -> its stories are
  `layout: 'fullscreen'`, which the card ignores: it pads its body by 24px, and its `.ds-single`
  wrapper's transform contains the sidebar's fixed panel -> owned `previews/Sidebar.tsx` takes the
  body's padding back with a `<style>`, as Storybook's fullscreen layout does. Byte-identical to
  Storybook. The only stories with `layout: 'fullscreen'` are Sidebar's
- [GENERAL] Tooltip's open stories drew their tooltip below the trigger, pushed against the left
  edge, and Sides' triggers stretched to full width -> the card ignores `parameters.layout`, and
  `centered` is Storybook's `.sb-main-centered`: a flex body as tall as the viewport, the root
  shrunk to its content and centred by `margin: auto` with 1rem of padding. Drawn at the card's
  top-left instead, 24px from the top, a tooltip above its trigger has no room and Radix flips it
  -> an owned preview lays every centred story out as Storybook does, `body { padding: 0 }` and
  the two boxes, as Sidebar's does for `fullscreen`: `previews/Tooltip.tsx`, all nine stories, and
  `previews/Calendar.tsx`, all but In Popover, which sets `padded` back. Popover's Top is centred
  too and keeps its generated preview: its own `pt-48` leaves the popover room, so only the framing
  differs. A story given `centered` later needs the same
- [GENERAL] A story taller than the viewport is verified to 700px alone by the viewport pair, and
  the harness's `__sb.png`, the whole element, faces a `__ds.png` cut at the viewport -> shoot both
  sides full page (`fullPage: true`) with the harness's stabilization, crop the preview's at
  +24+24, or +0+24 for a story centred by `mx-auto`, to the `__sb.png`'s size, and diff them:
  RichText's Document, RichTextEditor's Document, Document Round Trip and Collaborative
- RichTextEditor's Collaborative: each column 8px narrower in the card, its 16:9 video 4.5px
  shorter -> the grid spans the full width, and the card's 852px against Storybook's 868px share
  16px less between the two columns -> framing, the text wrapping alike
- [GENERAL] Select's Open drew its trigger in the viewport's corner and its list 10px right of it
  -> an open overlay that locks the page's scroll (Radix's Select, Dialog and Sheet, through
  react-remove-scroll-bar) writes `body[data-scroll-locked] { padding: <the body's margins>;
  margin: 0 }`, which outranks the card's `body { padding: 24px }`, while Storybook's padded class
  outranks the lock; flush against the edge, Select's list keeps its 10px of collision padding ->
  framing, of the card's shell, which the converter owns: Select's Open graded `close` with the
  reason. Dialog's and Sheet's trigger is hidden under their backdrop, so it shows nowhere else.
  DropdownMenu is not modal and keeps its gutter
- [GENERAL] Toaster: a clicked toast landed above the viewport, or four times over in the grid card
  -> sonner draws its fixed list in place rather than through a portal to the body, so the card's
  transformed wrapper, a cell or `.ds-single`, holds it instead of the viewport, and the wrapper is
  as tall as the row of triggers, 40px; and its toasts are global, so every mounted `<Toaster>`
  draws one -> `cardMode: "single"`, and owned `previews/Toaster.tsx` gives each story a box as tall
  as the viewport, the card's 24px gutter inside it: a toast lands where Storybook's does, and
  nothing changes at rest. Any fixed layer drawn in place needs the same
- Toaster `[RENDER_THIN]` (`variantsIdentical`): its four stories differ only in props that shape a
  toast, and none fires one, so all four draw the same seven triggers, in Storybook as in the card
- Stories closed until clicked, with no `defaultOpen` and no `play`, draw their trigger alone on
  both sides: Combobox's and MultiSelect's In Dialog, MultiSelect's Opened On Demand, every
  Toaster story. They grade `match`, and verify nothing of what opens
- Grading a centred story whose overlay has room either way: crop each side to its content's box
  (`magick <png> -fuzz 2% -format "%@" info:`), then diff the crops at 4% fuzz and stack them
- [GENERAL] An owned preview is linted and formatted as the repository is: the generated `compose`
  trips `unicorn/no-useless-fallback-in-spread` -> after copying a generated wrapper, `bunx oxlint
  --fix <file>` and `bunx oxfmt <file>`, then rebuild and recapture, since the edit moves its grade
  key
- Framing, not a difference: Storybook's canvas is the design system's body background, neutral,
  the card's is white; Storybook's padded layout insets the story by 16px, the card by 24px. So a
  full-width story is 868px wide in Storybook and 852px in the card (OrnamentDivider, Table), its
  centred content on the same x, and a root with nothing to measure is shot as the whole canvas
  (Progress' Indeterminate)
- Spinner `[RENDER_THIN]` (`allHollow`): a loader icon of 12 to 32px paints little. Both sides draw
  it alike, at the same frozen angle: the warning is the component's size, nothing to fix
- `[ASSETS_BLOCKED]` naming `example.invalid` alone is the Broken Image stories (Avatar,
  CompanyLogo) loading a reserved address on purpose. randomuser.me loads, so the shell reaches the
  network
- [GENERAL] RichTextEditor `[RENDER_ERRORS] text9.toDelta is not a function` -> its Collaborative
  story makes its `Y.Doc`s with `import * as Y from 'yjs'`, which the preview bundled as a second
  Yjs, while the editor runs y-prosemirror from the global's, and Yjs tells its types apart with
  `instanceof` -> `extraEntries: ["yjs"]` merges Yjs onto the global, and every bare `yjs` import
  in a preview, `y-protocols`' and the bundled `lib/createRichTextYUpdate`'s included, shims to
  it. `createRichTextYUpdate` stays bundled in the preview, a second BlockNote with it (1.3 MB): it
  only writes an update's bytes, which need no shared instance. `extraEntries` is in every
  component's grade key, so it went in before M2's first wave, and only M1's five were graded
  again
- Card modes: `overrides` take validate's `[GRID_OVERFLOW]` remedies for 15 components, `single`
  with an open story as primary for the overlays, `column` for the wide ones
- Stories past the harness's cap of six: Button 7 (`--max-stories 7` when capturing it),
  RichTextEditor 11, MultiSelect 9, Tooltip 9, ImageDropzone 8, Combobox 7
- [GENERAL] What the design agent reads misled it in every component: the props kept only those the
  package declares (`dts.mjs`'s `isOwnProp`), so Button had no `onClick` and Input no `value`, cut
  every comment at 120 characters and named `CSSProperties` unimported; the 72 parts of the compound
  components were typed nowhere; the examples were Storybook's source, `compose(S, "X")` and
  undefined fixtures -> each component's props are written by hand in the config's `dtsPropsFor`,
  which both the `.d.ts` and the usage note's Props print verbatim, and its usage note is
  `.design-sync/docs/<Name>.md`, found through `docsDir`, which replaces the generated variants,
  examples and related list: what it is, real JSX taken from the global, its parts, and what the
  API is not. Neither is in a grade key. A body is one prop or one-line comment a line, at two
  spaces, as the converter parses it; a note has no `## Props`, or the converter appends none, and
  stays under its 8000 characters
- [GENERAL] Nothing checked what the notes, the bodies or the conventions name -> `checkNames.ts`
  holds each body to the component's real type, both ways for the props the package declares, and
  every component, part, icon, class and custom property a note or the conventions use to what
  ships. It reads the declarations with the converter's own ts-morph, since the design system's
  TypeScript 7 has no compiler API, and maps the design system's alias to itself
  (`strategydance-design-system/*`), without which a props type built from another component reads
  as `any`. It cannot see a default or a behaviour a note describes that changed
- [GENERAL] Nothing ran the notes' examples: no capture renders them, and the name check reads their
  names alone -> `runExamples.ts` runs each as written against the built upload, React from
  `_vendor/react.js` as a card loads it. A block ends with the JSX it draws, or with the component
  it declares last, which it then draws; an overlay open from the start draws in the body, beside
  the root
- [GENERAL] No icon was on the global, so a design could pass none to a Button's `icon` ->
  `buildPackage.ts` adds `export * as Icons from 'lucide-react'` to the entry, a namespace since
  Lucide also exports `Calendar`, `Table` and `Badge`, which a flat `export *` would drop beside
  ours. Through the entry, not `extraEntries`, which is in every grade key and would shim the
  previews' own Lucide imports: no grade moved. The bundle grew 1.5 MB to 10.64 MiB of the
  upload's 12; Shiki's precompiled grammars are 3.64 MB of it, the lever should the cap near
- [GENERAL] A class nothing in the design system used had no rule, and failed silently ->
  `layoutClasses.ts`, the layout vocabulary, which `buildPackage.ts` compiles beside `index.css`
  through `@source inline()` in the sync's build alone. The stylesheet is Storybook's plus the
  vocabulary, every earlier rule kept, 118.8 KB to 193 KB. Tailwind drops a candidate it does not
  know without a word: `checkNames.ts` proves each one compiled
- `Choice` is internal, drawn by Checkbox, Radio and Switch alone -> off the global, through
  `INTERNAL_MODULE_PATTERN`. `Field` is public, the web app imports it -> a story of its own, both
  stories graded `match`
- [GENERAL] `[FONT_MISSING]` named "Inter", "SF Pro Display", "Open Sans" and "Arial Narrow", in
  which no text renders -> David dropped "Arial Narrow" from `--font-display`, and accepted
  BlockNote's default editor stack, which `RichTextEditor.css` replaces, through
  `runtimeFontPrefixes`, the check's only knob. Its `inter` prefix also matches "Inter Variable",
  so `checkNames.ts` asserts both shipped faces' `@font-face` instead
- [GENERAL] No provider wraps a design, so `provider` stays unset: Tooltip brings its own,
  `SidebarProvider` is the frame of an app with a sidebar, and the Toaster a sibling mounted once.
  Set, `provider` would wrap every card, and re-grade every component, since it is in every grade
  key. The conventions and the notes say when each applies
- The README's head is `conventions.md`, through `readmeHeader`: what the global holds, the wrap,
  the styling idiom with the design system's real tokens, the vocabulary in words, one example. The
  generated Tokens section below it lists every custom property, led by BlockNote's and
  Tailwind's, and only `tokensPkg` could change that, which the README would then name by its path
  under `node_modules`: the header says which are the design system's
- The global carries Yjs's exports beside the components (`Doc`, `Map`, `Text`, `Array`…), for the
  editor's collaborative story. The conventions say they are no components; removing them is
  `extraEntries`, which re-grades everything
- Tabs' Full Width story drew its triggers at their natural width, in Storybook as in the preview,
  the rule alone spanning `max-w-lg`: `tabVariants` is a cva, which merges no classes, so a trigger
  carried both the base's `flex-none` and the variant's `flex-1` -> fixed in the design system
  (#241), on `dev` before M3 merged, and M3 rebuilt the reference and graded Tabs again by hand,
  its grade cleared first, since it carries otherwise: `srcSha` hashes the story file alone
- The product's single card is full-bleed, its body unpadded, so an open story's trigger is flush
  with its left edge and a popup with collision padding sits right of it: Select's list by 10px,
  Combobox's and MultiSelect's by 5px -> accepted in M3: a few pixels of a popup's offset from a
  trigger at the card's very edge, outside the graded captures, which no design inherits, since a
  design lays out its own page
- [GENERAL] A copy of a remote file written with the Write tool is not the file: the repository's
  PostToolUse hook formats whatever Write or Edit writes inside the checkout, `.design-sync/.cache/`
  included, and Write turned a literal `\u2019` into the character -> M4 wrote its backup from the
  `get_file` answers as the session's transcript holds them
  (`~/.claude/projects/<project>/<session>.jsonl`), by a script, byte for byte. Do the same for a
  restore's source or any copy of what the project holds
- The project's store is case-sensitive: `readme.md`, the hand-made one, and the build's `README.md`
  were listed side by side before the delete, so deleting the first left the second. Its folder
  entries follow from the files' paths: deleting the 85 files took the 22 old folders with them
- The upload went as the skill orders it, with no retry: the sentinel, six content calls
  (`_ds_bundle.js`, 11.15 MB, alone; the two 1.2 MB scripts; the fonts; the 176 component files;
  the other previews; the root's three), one delete call, the sentinel again, `_ds_sync.json`
- [GENERAL] Budget M4's chart would have been dropped, `[TITLE_UNMAPPED]`: shadcn's chart exports
  `ChartContainer` and its parts, and no `Chart` for its stories' title -> the config's `titleMap`
  maps `Chart` to `ChartContainer`, which enters ChartContainer's grade key alone. The converter
  then names the component ChartContainer, so its note is `docs/ChartContainer.md` and its body
  `dtsPropsFor.ChartContainer`, and `checkNames.ts` reads the titles through the map
- [GENERAL] A design could not build a chart: `ChartContainer` sizes and dresses the recharts chart
  it is given and draws nothing itself -> `buildPackage.ts` adds recharts' parts to the entry as
  `Recharts`, beside `Icons` and for the same reason, the copy the container's tooltip and legend
  share their context with. `checkNames.ts` checks the names a note takes from it, and takes a
  `--color-<key>` a note's chart config names as the chart's own, which its container sets at
  runtime. A story importing `recharts` bundles it from source together with `Chart.tsx`, whose
  name is no export, so a preview runs on one recharts
- [GENERAL] The chart took `_ds_bundle.js` from 10.64 MiB to 11.96 MiB, 40 KB under the upload's
  12 MiB a file: the container alone brings 616 KB of recharts, unminified as the converter
  bundles, and recharts' whole namespace 744 KB more -> `Recharts` carries the parts
  `rechartsParts.ts` lists, the cartesian charts and the pie with their series, axes, marks,
  shapes and hooks, which leave it at 11.70 MiB, 310 KB under. Radar, radial bars, scatter,
  funnel, treemap, sankey and the brush wait for a design that needs them. The next component that
  weighs anything needs the lever above, Shiki's precompiled grammars

## Open

- `[TOKENS_MISSING]` `--shiki-*`, `--user-color-*`, `--available-height`, `--anchor-width`,
  `--transform-origin`, `--tw`: set at runtime by Shiki, the collaboration carets, Radix and Base
  UI's positioning and Tailwind. Nothing to ship
- Design system bugs the usage notes met, outside the sync, for David. Each note describes the
  component as it is, so a fix changes its note too:
  - Pill names its `<span>` with `aria-label`, which ARIA ignores on an element with no role, so a
    screen reader may read "99+" alone
  - SuggestionList spreads its props after its own `onMouseDown`, which keeps the field's focus, so
    a caller's `onMouseDown` replaces it
  - Calendar styles no `range`: every day of one fills as a picked day, since no react-day-picker
    stylesheet ships. The app picks single days alone
  - `outline-none` beside `focus-visible:outline-2` draws no focus ring under Tailwind 4, whose
    `outline-none` sets the `--tw-outline-style` the width's rule reads to none: Sidebar's rows,
    found in M4 with the keyboard, and the same pairing in Tabs' panels, Calendar's days and
    ImageDropzone. The chart takes the focus classes alone, as Button does
- ChartContainer is new since the record: the next `/design-sync` builds and grades its three
  stories, Default, Without Budget and Year Of Zeros, at rest. Its tooltip shows only under the
  pointer, which no capture verifies

## Re-sync risks

- What goes stale silently:
  - the 44 props bodies in `dtsPropsFor` and the notes in `docs/`, written by hand. `checkNames.ts`
    catches a prop renamed, removed or added, and a component, part, icon, class or token gone,
    never a default or a behaviour that changed: read a component's note and body whenever its
    source changes, and run the check
  - `conventions.md`'s prose: the vocabulary in words follows `layoutClasses.ts`, and the tokens'
    colours `index.css`. Change them together
  - a component's render: a grade follows its story file, never its component's source, so a fix
    that changes how a component draws and leaves its story alone carries the old grade, as Tabs'
    would have in M3. Grade it again by hand, its grade cleared, or spot-check it
    (`--spot-check-components`)
  - the owned previews: Sidebar's, Tooltip's and Calendar's wrappers follow their stories'
    `parameters.layout`, and Toaster's sonner's list drawn in place. Each composes its story module
    whole, so a story's edit reaches it, but not a change of layout
- What was verified only partly:
  - Toaster at rest alone, since no story fires a toast, and the stories closed until clicked
    (Combobox's and MultiSelect's In Dialog, MultiSelect's Opened On Demand), their trigger alone
  - the stories taller than the viewport, diffed full page once by hand, of which the harness sees
    the first 700px
  - by hand: the two manual captures, whose preview side the harness never shoots, and the
    viewport shots of overlays, centred and tall stories, which `captureStorybook.ts` takes
  - accepted: Select's Open `close`, a frame of the converter's own
  - the notes' examples: `runExamples.ts` proves each of the 88 runs and draws, and a few of its
    screenshots were looked at (M3: the conventions' screen, Sidebar's frame, Sheet, the editor,
    Table and Tabs), but none is graded against anything
- What the build assumes:
  - `extraEntries: ["yjs"]`, in every grade key, so removing it grades everything again
  - Lucide and recharts through the entry, and the bundle at 11.70 MiB of the upload's 12
  - `titleMap`'s `Chart` to `ChartContainer`, which a story file renamed or a `Chart` export would
    undo
  - the vocabulary through Tailwind 4's `@source inline()`
  - `runtimeFontPrefixes`' `inter`, which would hide a lost "Inter Variable" from validate, as
    `checkNames.ts` does not
  - `checkNames.ts` reading declarations with `.ds-sync/`'s ts-morph, so a fresh clone stages the
    skill's scripts before it runs
  - `--max-stories 11` for every capture, which RichTextEditor's 11 stories need

## A re-sync starts from

- The record M4 uploaded on 2026-10-23, `_ds_sync.json` (`keyRecipe` 7, `scriptsSha`
  `77113bc9d026db83`, `bundleSha12` `7a3dfd2f9db7`): 44 components and 189 stories, 188 `match` and
  Select's Open `close`. Its closing driver run carried every grade and cleared none, validate
  exited 0 with 44 of 44 previews clean, and the upload was byte for byte the build M3 graded
- The project holds 250 files: the build's 248, and the app's own `_ds_manifest.json` and
  `.thumbnail`, which a sync never writes or deletes
- The hand-made original is backed up, 89 files and a `MANIFEST.json`, in the main checkout's
  ignored `.design-sync/.cache/remote-backup/` on David's machine. Restoring one is a plan naming
  its path, written from there
- The main checkout's ignored `.ds-sync/` holds the scripts that built the record, without their
  `node_modules`. A newer skill stages newer ones, and the driver then reports the change as a
  canary to spot-check rather than a regrade
- Subagents may not edit the config: an overlay's `cardMode`, a skip or an import setting is the
  orchestrator's. A batch keeps its scratch files in a folder named after it, since batches share
  the scratchpad
