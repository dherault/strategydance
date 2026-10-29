# The design sync to Claude Design

| # | Milestone | Depends on | Implementation PR |
| --- | --- | --- | --- |
| M1 | The pipeline and the first checks | | #239 |
| M2 | Every storied component checked | M1 | #240 |
| M3 | The API and the conventions | M2 | #242 |
| M4 | The linked project replaced | M3 | #244 |

Claude Design builds screens and prototypes from React code it renders live. Out of the box it
builds with generic components. The design sync gives it Strategy Dance's real ones: the design
system's components compiled into one bundle, their props as `.d.ts`, a usage note for each, and a
preview card per component, all uploaded to a design-system project. From then on, what the design
agent draws is made of the parts the web app ships, with their tokens and fonts, and maps onto code
one to one.

The sync is the `/design-sync` skill of Claude Code. It reads the repository, builds the upload, and
checks every component's preview against the design system's own Storybook render before anything
leaves this machine. A component that renders wrong in the upload renders wrong in every design the
agent ever builds with it, so the check is the work.

The project is [Strategy Dance Design
System](https://claude.ai/design/p/61b2a9b3-1ee3-4661-a21d-a0b400b517f7), the one the design system
was ported from, as `packages/strategydance-design-system/src/index.css` says.

## What David decided

- **The linked project is replaced whole.** It holds the hand-made original: 19 components written
  for Claude Design, its token files, 16 guideline pages, two logos, a `SKILL.md` and a readme. Once
  the sync uploads, it holds the repository's components and nothing else, and every hand-made file
  the build does not produce is deleted.
- **The upload is atomic.** The project is in use and not empty, so nothing is uploaded until every
  component has been checked. Then one pass writes everything and deletes the rest.
- **The work goes in milestones**, each a pull request, below, and listed in the table at the top.
- **The display face falls back to the system's sans** (M3). `'Arial Narrow'` left
  `--font-display`: no text renders in it once Oswald loads, and the font check named it. BlockNote's
  default editor fonts, which `RichTextEditor.css` replaces, are accepted as they are.
- **A design gets a stated layout vocabulary** (M3): the classes `layoutClasses.ts` lists, compiled
  into the upload's stylesheet alone, so the agent lays out a screen with classes that exist rather
  than ones that fail silently.
- **Every Lucide icon rides the global** (M3), as `Icons`, so a design passes the same icons the
  product does to a Button, an Alert or a sidebar item.
- **The hand-made original is kept on David's machine** (M4): every file the upload deleted or
  replaced, saved under the main checkout's `.design-sync/.cache/remote-backup/`, which git ignores,
  with a `MANIFEST.json` naming each. The skill's scripts went beside it, in `.ds-sync/`, so a sync
  from the main checkout finds them even before the skill stages them again.
- **`.thumbnail` stays** (M4): the picture of the project the app renders and signs, its own file
  as `_ds_manifest.json` is.

## Where the work happens

The skill's state is in three places:

- **Committed**, under `.design-sync/` at the root: `config.json`, the converter's settings and the
  project's id, with each component's props, written by hand; `NOTES.md`, every quirk met and how
  it was fixed; `buildPackage.ts`, below, with `layoutClasses.ts`, the layout vocabulary;
  `conventions.md`, the header the design agent reads first; `docs/`, each component's usage note;
  `checkNames.ts`, which checks every name those files give against the build; `runExamples.ts`,
  which runs every example they give; and `previews/`, any preview written by hand. A later sync
  replays all of it.
- **Ignored, and local to one checkout**: `.design-sync/sb-reference/`, the reference Storybook;
  `.design-sync/.cache/`, the generated previews and the grades the checks earned; `.ds-sync/`, the
  skill's scripts and their dependencies (esbuild, ts-morph, Playwright and its Chromium), installed
  with npm, outside Bun's lockfile; `ds-bundle/`, the built upload.
- **In the project**: `_ds_sync.json`, the hashes of what was checked and uploaded, which let a
  later sync check only what changed.

From M1 to M3 the grades lived only in `.design-sync/.cache/`, so the campaign kept one worktree,
`.claude/worktrees/design-sync`, from the first milestone to the last. Since M4 the record is in
the project, and a sync runs from any checkout: what it needs locally it builds again, and what it
checked before, the record vouches for. The worktree goes once M4 merges.

### Why the design system is built twice

The converter wants a built package: an entry it bundles, and a `package.json` whose `types` leads to
a `.d.ts` tree, which it reads the props from. The design system ships TypeScript source and no root
export, since its consumers import each component by its path. `bun .design-sync/buildPackage.ts`
builds that package under `packages/strategydance-design-system/node_modules/.cache/design-sync/`,
which git ignores: an entry re-exporting every component module, the editor's own parts aside, the
declarations `tsc` emits for them, and `index.css` built by Vite and Tailwind as Storybook builds
it, with the fonts, since no component imports it. The converter finds a package by walking up from
its entry to the first `package.json` with a name, so the built one names itself as the design
system does. It is the config's `buildCmd`, run before every build.

The converter runs with `--node-modules packages/strategydance-design-system/node_modules`: Bun
installs each package's dependencies into its own `node_modules`, so the root one holds no React.

## Milestones

### M1. The pipeline and the first checks

- `.design-sync/config.json`, with the project pinned, and the ignored paths in `.gitignore`
- `buildPackage.ts`, and a clean converter build and validation
- the reference Storybook built
- five components checked by hand, every story, as the skill's solo phase asks, so problems that
  touch every component surface before the fan-out: Button, the simple one; Dialog, an overlay;
  Avatar, whose stories load a remote picture, which shows whether the browser can reach the
  network; Sidebar, which needs its provider; and Markdown, the text-heavy one, for Inter, Oswald and
  the descenders' room
- `NOTES.md`, with every fix and what M2 starts from

Done when the converter and the validation both exit 0 and each of the five grades `match` on every
story, or `close` with a note saying what is off and what was tried.

### M2. Every storied component checked

The other 38 components with stories, in waves of at most four subagents, five to eight components
each, related ones together. Between waves, what a subagent found that touches more than one
component goes into the config and `NOTES.md` before the next wave starts. Overlays (Dialog, Sheet,
Popover, DropdownMenu, Tooltip, Toaster, Combobox) draw one story per card. RichTextEditor, RichText,
Calendar and the other heavy ones go in the last wave. A story that cannot render outside Storybook
is skipped, with the reason in `NOTES.md`.

Done when every storied component's stories all grade `match`, or `close` with their note.

### M3. The API and the conventions

- The components without a story: Field, which the web app imports itself, kept, with a story of
  its own; Choice, the row Checkbox, Radio and Switch lay out in, taken off the global
- Each component's props, written by hand in the config's `dtsPropsFor`, and its usage note,
  `.design-sync/docs/<Name>.md`, read as the design agent will read them. The generated ones dropped
  every native and Radix prop, cut every comment at 120 characters, typed none of the compound
  components' parts and showed Storybook's source for examples
- No provider wraps a design, so the config names none: Tooltip brings its own, `SidebarProvider` is
  the frame of an app with a sidebar, and the Toaster is mounted once beside the page. The
  conventions and the usage notes say when each applies
- The layout vocabulary, David's choice: `layoutClasses.ts` compiled into the upload's stylesheet,
  since the stylesheet holds only what something compiled and a class with no rule fails silently
- Lucide's icons on the global as `Icons`, David's choice, through the package's entry, which
  carries every grade
- `.design-sync/conventions.md`, the header of the README the design agent reads first: the wrap, the
  styling idiom with its real token names, where the stylesheets are, one example
- `checkNames.ts`, which checks every name the props, the notes and the conventions give against the
  build: each prop against the component's real type, each component, part, icon, class and token
  against what ships; and `runExamples.ts`, which runs every example the notes and the conventions
  give, as written, against the built upload
- The font check settled, David's choice: Oswald's fallback dropped, BlockNote's default editor
  fonts accepted
- The closing check, the skill's driver run over the whole roster, with nothing left to grade
- `NOTES.md`'s Re-sync risks: what can go stale, what was only partly checked, what the build
  assumes

Done when the driver's verdict is clean and the validation exits 0.

### M4. The linked project replaced

1. A copy of every remote file about to be deleted, saved under `.design-sync/.cache/remote-backup/`
2. The delete list, read against the project's file list: every path the build does not produce, the
   old `components/<name>/` folders, `tokens/`, `guidelines/`, `assets/`, `SKILL.md`, `readme.md`,
   `_adherence.oxlintrc.json` and `thumbnail.html`. `_ds_manifest.json` is the app's own, which it
   rebuilds, and stays
3. One approval for the writes and the deletes, then the upload in its fixed order: the sentinel
   that fences the app off a half-written project, every file, the deletes, the sentinel again, and
   `_ds_sync.json` last, so the record only ever vouches for an upload that finished. A count of the
   project's files confirms it
4. The design system's CLAUDE.md says where the sync lives and how to run it again, and `index.css`'s header says the
   project now follows the repository
5. The campaign worktree is removed, once M4 merges, since its review is fixed there

Done when the project's file list is the build's files, `_ds_manifest.json` and `.thumbnail`, and
nothing else, with `_ds_sync.json` written last.

## Running it again

A sync after a change to the design system is `/design-sync` again, started by a person, from any
checkout. It reads `NOTES.md` first, rebuilds the package and the reference Storybook together,
fetches `_ds_sync.json` from the project, and runs the skill's driver against it, which checks only
the components that changed since the record and carries every other grade. What changed is
graded, then uploaded in the same fixed order as M4's, the deletes the driver lists included, after
one approval. `NOTES.md` gives the commands, what a fresh checkout needs first, and its Re-sync
risks what no check catches.
