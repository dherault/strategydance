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
- A full converter build takes 15 to 25 minutes, nearly all of it compiling the 43 previews one at
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
  fonts beside it under their own names, and the config's `cssEntry` appends it. It matches
  Storybook's compiled CSS byte for byte but the fonts' addresses (118.8 KB against 119.0 KB)
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

## Open

- `[FONT_MISSING]` "Inter", "SF Pro Display", "Open Sans", "Arial Narrow": the check reads every
  family of every font stack. The first three are BlockNote's default `--bn-font-family`, which
  `RichTextEditor.css` replaces with `var(--font-sans)` on the editor's root; the last is the
  fallback after "Oswald Variable". Inter Variable and Oswald Variable ship, 19 faces, and no text
  renders in the four. Accepting it is David's call, before M3's closing check
- `[TOKENS_MISSING]` `--shiki-*`, `--user-color-*`, `--available-height`, `--anchor-width`,
  `--transform-origin`, `--tw`: set at runtime by Shiki, the collaboration carets, Radix and Base
  UI's positioning and Tailwind. Nothing to ship
- The global carries Yjs's exports beside the components (`Doc`, `Map`, `Text`, `applyUpdate`…),
  for the editor's stories: M3's read of the API says whether the design agent is told of them
- The product's single card is full-bleed, its body unpadded, so an open story's trigger is flush
  with its left edge and a popup with collision padding sits right of it: Select's list by 10px,
  Combobox's and MultiSelect's by 5px. Presentation only, outside the graded captures, which keep
  the 24px gutter; M3 says whether it matters to a designer
- Tabs' Full Width story: its triggers keep their natural width, in Storybook as in the preview,
  and only the rule spans `max-w-lg`. `tabVariants` is a cva, which merges no classes, so a trigger
  carries both the base's `flex-none` and the variant's `flex-1`, and `.flex-none` comes later in
  the compiled CSS. A bug of the design system's, outside the sync, for David: its fix moves Tabs'
  render, so the reference is rebuilt and Tabs graded again

## M3 starts from

- Every storied component graded, in the campaign worktree's `.design-sync/.cache/compare/`: 43
  components, 187 stories, every one captured (`--max-stories 11`). 186 grade `match`, Select's Open
  `close` (the scroll lock, above), none skipped. Calendar's In Dialog and RichText's Unreadable
  are `match` from manual captures. A compare over all 43 carries every one forward, nothing
  captured and no grade cleared
- The last full build and validate were M2's first step, validate exiting 0 with all 43 previews
  rendering cleanly. The owned previews since were rebuilt one at a time, so M3's closing driver
  run is the first full build over them
- Owned previews: Sidebar (`fullscreen`), Tooltip and Calendar (`centered`), Toaster (a box as tall
  as the viewport). Each composes its story module whole, so a story's edit reaches it, but its
  wrapper follows the story's `parameters.layout` and Toaster's sonner: a change to either moves
  what it has to do
- For M3's Re-sync risks:
  - verified partly: Toaster at rest alone, since no story fires a toast, and the stories closed
    until clicked (Combobox's and MultiSelect's In Dialog, MultiSelect's Opened On Demand) their
    trigger alone; the stories taller than the viewport were diffed full page once, by hand, and
    the harness sees their first 700px
  - by hand: the two manual captures, whose preview side the harness never shoots, and the
    viewport shots of overlays, centred and tall stories, which `captureStorybook.ts` takes
  - accepted: Select's Open `close`, a frame of the converter's own
  - assumed: `extraEntries: ["yjs"]`, in every grade key, so removing it grades everything again
- Subagents may not edit the config: an overlay's `cardMode`, a skip or an import setting is the
  orchestrator's. A batch keeps its scratch files in a folder named after it, since batches share
  the scratchpad
