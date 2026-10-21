# The design sync to Claude Design

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
- **The work goes in milestones**, each a pull request, below.

## Where the work happens

The skill's state is in three places:

- **Committed**, under `.design-sync/` at the root: `config.json`, the converter's settings and the
  project's id; `NOTES.md`, every quirk met and how it was fixed; `buildPackage.ts`, below; later
  `conventions.md`, the header the design agent reads first, and `previews/`, any preview written
  by hand. A later sync replays all of it.
- **Ignored, and local to one checkout**: `.design-sync/sb-reference/`, the reference Storybook;
  `.design-sync/.cache/`, the generated previews and the grades the checks earned; `.ds-sync/`, the
  skill's scripts and their dependencies (esbuild, ts-morph, Playwright and its Chromium), installed
  with npm, outside Bun's lockfile; `ds-bundle/`, the built upload.
- **In the project**, once uploaded: `_ds_sync.json`, the hashes that let a later sync check only
  what changed.

Grades exist only in `.design-sync/.cache/` until milestone 4 uploads them as `_ds_sync.json`, so
the campaign keeps one worktree, `.claude/worktrees/design-sync`, from the first milestone to the
last, each milestone on a branch of its own from a fresh `origin/dev`. Ignored files survive a
branch switch. If the worktree is lost, its grades are earned again, which costs time and nothing
else.

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

- Which components without a story are public: Choice and Field, kept or dropped
- The `.d.ts` and the usage note of each component, read as the design agent will read them
- The providers a design needs around the components, TooltipProvider, SidebarProvider and the
  Toaster, written into the config, so the usage notes say when to wrap
- The Tailwind classes the design agent may write. The upload carries the CSS the design system's
  own classes compile to and nothing more, so a class it never uses has no rule there. Settle what
  the agent gets for its own layout
- `.design-sync/conventions.md`, the header of the README the design agent reads first: the wrap, the
  styling idiom with its real token names, where the stylesheets are, one example. Every name it
  gives is checked against the build
- David's word on the font check, which names four families no text renders in: BlockNote's
  default editor font, which the editor's stylesheet replaces, and Oswald's fallback (`NOTES.md`,
  Open)
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
4. CLAUDE.md says where the sync lives and how to run it again, and `index.css`'s header says the
   project now follows the repository
5. The campaign worktree is removed

## Continuing in a later session

From M1 on, `.design-sync/config.json` holds the project's id and the package's name, which the
skill reads as a sync that has run before. It has not, until M4 uploads `_ds_sync.json`. A session
that picks up M2 or M3 says so when it starts `/design-sync`, works in the campaign worktree, reads
`NOTES.md` first, and follows the milestone here rather than the skill's re-sync section. Its
closing check runs the driver without `--remote`, since the project has no record yet.

## After M4

A sync after a change to the design system is `/design-sync` again. It fetches `_ds_sync.json` from
the project, rebuilds, checks only the components whose sources changed, and uploads the difference.
