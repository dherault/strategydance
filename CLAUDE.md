# CLAUDE.md

Guidance for Claude Code when working in this repository.

**Every change to a tracked file ships without asking.** It is made on its own branch, in a
worktree or in the main checkout when the session holds it, committed granularly as each piece
passes CI's checks, pushed, opened as a pull request into `dev` and taken through the CodeRabbit
review loop, until all that is left for a human is the merge. That is the person's standing
request in every session, so never ask whether to commit, push, open the pull request or address
the review. [Workflow](#workflow) says how.

`AGENTS.md` is a symlink to this file: edit `CLAUDE.md` only.

## Vision

Strategy Dance aims to create partly autonomous companies that involve both humans and AIs.

Its first iteration will act as an overseer and companion for solo entrepreneurs, helping them
build, distribute, stay accountable, stay consistent, and, more generally, act on their projects
using AI guidance and human wisdom. Progressively, AI guidance will evolve into AI execution,
performing tasks typically reserved for humans.

In the long term, we would create 100% automated companies. We could also provide existing
organizations with AI employees across various departments and possibly offer salaries to the
humans who work for AI-led companies.

The main challenge is to solve company creation and execution by creating a universal system.
The answer lies in architecture and design.

## Stack

A [Bun](https://bun.com) workspaces monorepo. Packages live under `packages/`.

- `packages/strategydance-web` — TanStack Start in SPA mode, React 19 (with the React compiler),
  Tailwind CSS v4, built by Vite
- `packages/strategydance-core` — types, enums and constants every package agrees on. Zero
  runtime dependencies, so it is importable from the browser bundle and from a Node script
  alike. Keep it that way
- `packages/strategydance-directories` — the places a startup can be submitted to, websites and
  Reddit communities: `DIRECTORIES`, from `src/directories.json`, and `INACTIVE_DIRECTORIES`,
  those nothing can be submitted to today, from `src/inactiveDirectories.json`, a directory in one
  list or the other, never both. A directory's `id` is a slug that never changes, even on a rename.
  Data and types with no runtime dependency, as the core is. The backend's daily check keeps both
  lists true through a pull request a human merges ([directories.md](documents/directories.md)).
  Both files are written as `JSON.stringify(list, null, 2)` writes them, sorted by name, which the
  tests hold them to, and oxfmt leaves them alone
- `packages/strategydance-external-mcp-servers` — the remote MCP servers an organization adds in a
  click from its Integrations page, `EXTERNAL_MCP_SERVERS` from `src/externalMcpServers.json`, data
  with no runtime dependency. `bun run probe:integrations`, in the backend's package, checks an
  entry before it ships, and the package's README says how one is added
- `packages/strategydance-database` — the Firebase Data Connect service: the Postgres schema, one
  connector per caller, and the SDK generated from them, imported as `strategydance-database/web`,
  `strategydance-database/web/react` for the TanStack Query hooks, and
  `strategydance-database/backend`. See [The database](#the-database)
- `packages/strategydance-backend` — a Bun and Express server on Cloud Run, for what the browser
  cannot do itself because it needs a secret or the server's word: invitations and their emails,
  uploads, link previews, conversations, the modules served to members' own agents through its
  OAuth authorization server, and the organizations' MCP servers. Its image runs a second time as
  the private worker, which runs conversations as Cloud Tasks delivers them, and the daily sweep and
  directories check. See [Backend conventions](#backend-conventions)
- `packages/strategydance-design-system` — the component library: shadcn on Radix, and on Base UI
  where shadcn is (its combobox), Tailwind CSS v4, documented in Storybook. Another package imports
  `strategydance-design-system/components/ui/Button` and `strategydance-design-system/index.css`,
  and the package imports itself by that name, mapped to its `src/`, so a component resolves the
  same when another package reads it as source. Its tokens and components keep the props of the
  Claude Design project they were ported from, which now follows them
  ([The design sync](#the-design-sync)). Its rich text:
  - The editor is [BlockNote](https://www.blocknotejs.org)'s, in its shadcn flavour, and
    `RichText` draws what it writes without it. A post writes `RICH_TEXT_POST_BLOCKS`, a task's
    description `RICH_TEXT_TASK_BLOCKS`, a knowledge document `RICH_TEXT_EDITOR_BLOCKS`, the
    default, and `RichText` draws a post's blocks unless told more. Inline code goes alone and out
    of links
  - The editor's own blocks and mentions are the core's `createBlockSpec` and
    `createInlineContentSpec` on plain DOM, never React, so the headless editor the Yjs helpers
    convert through loads no React. A mention's chip is a span, since BlockNote reads a pasted
    outer link as a link before the mention. Mentions are drawn from the page's `mentions`, which
    the web builds with `useRichTextMentionSource`
  - BlockNote's menus are its own Base UI copies of shadcn's components, so `RichTextEditor.css`
    dresses them in the tokens, by their `bn-` classes and `data-slot`s
  - The agent's replies are Markdown: draw them through `Markdown`, never `react-markdown`
    directly. It keeps them to the thread's subset, draws HTML as text, links only to web, mail,
    `doc:` and `task:` addresses (`renderLink` draws the last two), never loads an image, and draws
    a text past `MARKDOWN_HAZARD_LIMITS` (`lib/countMarkdownHazards`) as plain text rather than
    hand it to micromark, at the counts measured on a piece's 20000 characters (M37). A shape found
    slow later joins the count, measured the same way
  - A member's message is not Markdown: the thread draws it as typed, its `[Title](doc:<id>)`
    mentions alone as links (`parseConversationMemberText`)
  - An agent reads and writes a document's text in Markdown through `richTextToMarkdown` and
    `markdownToRichText`, a mention as `[title](doc:<id>)` or `[name](task:<id>)`.
    `markdownToRichText` parses with markdown-it, never micromark, which takes minutes on lists or
    brackets by the thousand, and so does the backend's `splitConversationText`
- `packages/strategydance-translations` — the Gemini-backed CLI that fills the locale catalogues.
  Node-only: never import it from the frontend
- `packages/strategydance-emails` — the transactional emails, as [React Email](https://react.email)
  templates. Node-only: the backend renders them. See [Email conventions](#email-conventions)
- `documents/`, at the root — documents written for people, in Markdown alone: `.gitignore` hides
  any other file there. A commit there is scoped `[documents]`
- [oxlint](https://oxc.rs) lints and oxfmt formats. See [Linting and
  formatting](#linting-and-formatting)
- `tsc` typechecks. `packages/strategydance-web` imports through `~` aliases (`~components`,
  `~contexts`, `~data`, `~hooks`, `~utils`, `~constants`, `~types`), declared in its
  `tsconfig.json` and mirrored in `vite.config.ts`. The backend has its own, which Bun reads at
  runtime. Cross-package imports use the package name
- `bunfig.toml` sets a 7-day install cooldown: a version must have been published for a week
  before it can be installed

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Web dev server on http://localhost:5173. Wants `dev:emulators` beside it, and `dev:backend` for anything that calls the backend |
| `bun run dev:emulators` | Auth, Data Connect and Storage emulators, with a UI on http://localhost:4000 |
| `bun run dev:backend` | The backend on http://localhost:3003, against the emulators. It answers conversations with Claude, which costs money, unless started with `CONVERSATION_AGENT=placeholder`, which answers with a stand-in reply |
| `bun run dev:emails` | React Email's preview server on the templates, on http://localhost:3000 |
| `bun run grant:administrator <email>` | Makes an account that has signed in once an administrator of Strategy Dance, in the emulators only. Nothing grants it in production |
| `bun run send:conversation <email> [--conversation <id>] [--file <path>]… [--organization <id or slug>] <text>` | Sends a message to a conversation, a new one unless one is named, through `dev:backend`, as that account, uploading each file, a path from the repository's root, first, and prints the conversation's address |
| `bun run measure:subagents [--configurations <name,…>] [--briefs <name,…>] [--max-total <dollars>] [--max-subagent <dollars>]` | Prices short briefs run as subagents on each model and effort weighed, from a throwaway account of the emulators, a dollar a subagent and fifteen in all at most, and prints the table David chooses `SUBAGENT_REQUEST_SETTINGS` from. `--briefs long` runs one made to run long instead: `--configurations opus-medium --max-subagent 3 --max-total 3`. It costs money unless run under `CONVERSATION_AGENT=placeholder` |
| `bun run launch:subagent <email> --conversation <id> [--count <n>] [--file <attachment id>]… <brief>` | Launches up to 10 subagents of that account's conversation, as the Subagents module does, in its own process, and prints each transcript and report. A promotion runs in the process that freed the slot, so launch an account's subagents from one script at a time. Emulators only, and it costs money unless run under `CONVERSATION_AGENT=placeholder` |
| `bun run mcp:knowledge <email> [--organization <id or slug>]` / `mcp:tasks` | Serves the Knowledge or the Tasks module over stdio as that account of the emulators, with every scope, for an MCP client on this machine: `claude mcp add strategydance-knowledge-local -- bun run mcp:knowledge <email>`. See [Module conventions](#module-conventions) |
| `bun run check:directories [--count <n>] [--inactive <n>] [--name <name>]… [--dry-run] [--publish]` | Runs the directories' daily check into this checkout's two files, or with `--publish` into the rolling pull request on GitHub. About $0.10 a directory. See [directories.md](documents/directories.md) |
| `bun run probe:claude` | Sends Claude's API the conversations agent's request and checks what only the real model can confirm, exiting non-zero on a failed check. It costs money: run it after an Anthropic SDK bump, a change of model, price or top output rate, or of a module's tools, never in CI. Its key is the `anthropic-api-key` secret, read with Application Default Credentials, or `ANTHROPIC_API_KEY` when set |
| `bun run storybook` | The design system's Storybook on http://localhost:6006 |
| `bun run build` | Typechecks and builds the design system's Storybook, then the web package to static files |
| `bun run preview` | Builds against the emulators, then serves `dist/client` through the Hosting emulator on http://localhost:5050 |
| `bun run lint` | oxlint across the repo, then oxfmt's check. A warning fails it, and so does an unformatted file |
| `bun run lint:fix` / `format` | Applies oxlint's safe fixes, then formats; or only formats |
| `bun run typecheck` | `tsc` across the packages |
| `bun run test` | `bun test` across the packages, each file in a fresh global so a `mock.module` stays in the file that made it |
| `bun run generate:database` | Regenerates the Data Connect SDK. `postinstall` already does this |
| `bun run translate` | Fills the locale catalogues from the `defaultMessage`s. Run it when a message changes |
| `bun run ship` | Opens the release pull request, from `dev` to `main`, unless one is already open, and sets it to merge itself once CI passes |
| `bun run review <command>` | The GitHub calls of the CodeRabbit review loop: `wait`, `body`, `threads`, `reply`, `resolve` and `open`. See [CodeRabbit review loop](#coderabbit-review-loop) |
| `bun run deploy:backend` | Builds the root `Dockerfile` on Cloud Run and deploys `strategydance-backend`, then the same image as `strategydance-worker` (`scripts/deploy.sh` in the backend's package). Every push to `main` runs it too |
| `bun run kill` / `kill:backend` / `kill:emulators` | Kills the dev server, the backend, or the emulators, found by the ports they listen on, leaving a browser connected to them alone |

**CI's definition of green** is the pull request check: `bun run lint && bun run typecheck &&
bun run test && bun run build` from the root. Run those four before every commit: the husky
`pre-commit` hook only lints.

**The `deploy:*` scripts and `bun run ship` are run by humans only**, since a release merges and
deploys by itself ([What a merge into `main` deploys](#what-a-merge-into-main-deploys)).

Two things are generated and never edited by hand: `packages/strategydance-web/src/routeTree.gen.ts`,
written by the TanStack Router plugin on dev and build and committed, since `tsc` needs it, and
`packages/strategydance-database/generated/`, written by the Firebase CLI on `postinstall`, hence
`firebase-tools` as a devDependency, and not committed, since a clone generates its own with no
credentials or network.

### Linting and formatting

`bun run lint` checks oxlint and oxfmt, from the root's `.oxlintrc.json` and `.oxfmtrc.json`: an
unformatted file, a warning and a disable directive that suppresses nothing all fail it, in CI and
in the husky `pre-commit` hook. `bun run lint:fix` stops before formatting while an error it cannot
fix remains. A PostToolUse hook runs `oxlint --fix` on each `.ts`/`.tsx` Claude Code edits under
`packages/`, then oxfmt on anything it formats, and a Stop hook typechecks every package when a turn
ends. VS Code formats on save through the oxc extension.

- **Keep it to one config.** A nested `.oxlintrc.json` replaces the root one for its directory
  rather than extending it, silently dropping every rule: a package's rule goes in the root's
  `overrides`
- **The formatter owns layout**: two spaces, single quotes, no semicolons, one JSX prop per line,
  120 columns. Only the order of a `className`'s classes is kept by hand, a semantic order oxfmt's
  Tailwind sorting would replace
- **So is import order.** Imports sort into the groups `.oxfmtrc.json` lists, one per alias, and an
  import no group matches sorts into `rest`, last, so a new `~` alias needs a group of its own. A
  `/// <reference>` directive moves with the import below it, and TypeScript ignores one that is not
  at the top: keep it above the import that sorts first
- **Markdown and HTML are not formatted**, nor is what a generator writes (`routeTree.gen.ts`, the
  Data Connect SDK, the translated catalogues, the translation lock, the directories' two lists).
  The schema and the connectors are
- **An unused import is an error `--fix` does not remove**, so one written before the code that uses
  it survives the edit hook and is only reported
- A suppression is `// oxlint-disable-next-line <rule>` under oxlint's names
  (`react/exhaustive-deps`, not `react-hooks/exhaustive-deps`), covering the line below it as
  formatted, which is not always where it was written once a long statement wraps

## Frontend conventions

### No manual memoization

The React compiler memoizes components and values itself, so never write `useCallback` or
`useMemo`: the repo has none. `useRef` and `useState`'s lazy initializer stay.

`.oxlintrc.json` turns the compiler's diagnostics on as `react/*` rules (`purity`, `immutability`,
`set-state-in-render` and the rest), which report at lint time what it would refuse to optimize.

oxlint's `react-hooks(exhaustive-deps)` reads the source rather than the compiler's output, so it
flags a plain function of a component's body in a dependency array. Restructure rather than reach
for `useCallback`: define the function inside the effect, or have the effect call the stable thing
(a mutation from a hook, a setter) directly.

### One concern, one file

A hook, a context, a provider, a waiter and a bouncer are five kinds of thing, and each gets its
own file, however short.

| Kind | Where | Named |
| --- | --- | --- |
| Context | `src/contexts/`, flat | `XContext.ts`, named for its domain: `ChatHomeContext`, not `HomeContext` |
| Provider | `src/components/<domain>/` | `_XProvider.tsx`; the leading underscore sorts it to the bottom of the listing |
| Hook | `src/hooks/<domain>/` | `useX.ts`, default-exported, one per file, under the same domain as its provider |
| Waiter | `src/components/<domain>/` | `XWait.tsx` — renders `<Loading />` until its data lands, then passes `children` through. Gates, never decides |
| Bouncer | `src/components/<domain>/` | `XBouncer.tsx` — turns a resolved verdict into a screen or a redirect, or passes `children` through. Decides, never waits |

**A waiter sits above the bouncer that reads the same data**, or the bouncer judges a value that
has not loaded. `IntlMessagesRegistration` is a waiter parameterized by the catalogues it waits on.

### Where a provider is mounted

Providers go in `getRouter`'s `Wrap` in `src/router.tsx`, and one that reads the router in
`InnerWrap` beside it, as `_CurrentOrganizationProvider` and `_ConversationDockProvider` do. Waiters
and bouncers never go there: `Wrap` sits above the document shell, so anything there that withholds
its children replaces the whole document, `<Scripts />` included, and the page never boots.
Anything that gates belongs in `__root.tsx`'s `component` or below.

### UI comes from the design system

The frontend has no shadcn setup of its own: buttons, inputs, the logo and the rest come from
`strategydance-design-system`, and a primitive it lacks is added there, with a story.
`src/components/ui/` holds only glue around them, `FormField` for react-hook-form and `TextDivider`.

- Text a page writes into a field itself, as a mention's pick does, goes through
  `replaceTextareaRange` in `~utils/common`, so `onChange`, the caret and the browser's undo take it
  as typing. A list a field drives while it keeps the focus is the design system's `SuggestionList`
- A field's text is 16px on a touch screen, or iOS zooms into it and stays zoomed. `inputClassName`
  carries `pointer-coarse:text-base`, and a field not built on it, like the `MultiSelect`'s search,
  the editor and its link field, sets it itself. Never put `maximum-scale=1` in the viewport:
  Android then refuses the pinch zoom
- Oswald hangs its descenders below the line box of its tight leading, so a box that clips its
  overflow cuts them off. The design system's `index.css` keeps their room in one place,
  `--descender-room`: an h1 to h3, or text in `font-display` or `font-heading`, that clips itself
  gets it automatically, a box that clips display text it does not set takes the `descender-room`
  utility, and `RichText` and FitText count their own. A descender cut elsewhere is a gap to widen
  in `index.css`, never a padding on one element: the Typography page in Storybook shows each case
- Strings stay in the frontend's catalogues. A design-system component that names itself in English
  gets its label from `react-intl` where the frontend uses it, as `~components/common/Spinner`
  labels the spinner. BlockNote's menus are the exception, translated by BlockNote: `RichTextEditor`
  takes the app's `locale`, and only its placeholder and the words BlockNote lacks come through
  `labels`, the block menu's "Turn into" (`log.editorTurnInto`), which every caller passes, and the
  knowledge editor's video and link preview words
- A Base UI popup is a stranger to Radix's layers: a modal Radix dialog traps focus, disables
  pointer events outside itself and dismisses on any Escape. The `MultiSelect` portals its list into
  the dialog around its trigger and claims Escape while open, and a Base UI popup added later needs
  both, with a story inside a `Dialog`. BlockNote's menus are Base UI's too: they portal into the
  editor, `RichTextEditor` claims Escape while one is open, and it floats its toolbar over the
  selection on touch screens, since BlockNote's mobile toolbar portals to the body

### The design sync

The Strategy Dance Design System project in Claude Design
(`https://claude.ai/design/p/61b2a9b3-1ee3-4661-a21d-a0b400b517f7`) holds the design system's
components for its design agent. It follows this repository through the `/design-sync` skill, which
a person starts, which checks every preview against Storybook and uploads after one approval.
[design-sync.md](documents/design-sync.md) says why it is built so, and `.design-sync/NOTES.md`,
which a sync reads first, how to run it.

- Nothing syncs on a merge: the next `/design-sync` checks only what changed since the project's
  record, `_ds_sync.json`
- A component's props and usage note are written by hand, in `.design-sync/config.json`'s
  `dtsPropsFor` and `.design-sync/docs/<Name>.md`, and the agent reads them as its API: a change to a
  component's props or behaviour changes them too. `bun .design-sync/checkNames.ts` and `bun
  .design-sync/runExamples.ts` catch a name gone or an example broken, never a changed default or
  behaviour
- A grade follows the story file, not the component's source: a component that draws differently
  under the same story keeps its grade until it is cleared, as NOTES.md says
- What a sync builds stays local and ignored: `.ds-sync/`, `.design-sync/sb-reference/`,
  `.design-sync/.cache/` and `ds-bundle/`. A commit under `.design-sync/` is scoped `[root]`

### Static files

`packages/strategydance-web/public/` is served as is from the site root, unhashed: images go under
`public/assets/images/`, so the logos are at `/assets/images/logo/logo-black.svg`, for whatever
needs a URL, like an email. Inside the app the mark is the design system's `Logo`.

`firebase.json` caches Vite's hashed bundles, flat in `/assets/`, for a year as immutable. Its
source is `/assets/*`, one star, so an image under `/assets/images/` keeps the one-day image rule:
`/assets/**` would pin an edited logo in browsers for a year.

### Firebase

`src/data/firebase.ts` initializes Auth, App Check, Data Connect, Storage and Performance, and
nothing else calls `initializeApp`.

- **Guard anything that touches a browser global**, with its `isBrowser`: SPA mode prerenders the
  shell in Node at build time, evaluating every module a route imports with no `window`, which is
  why `appCheck` is nullable
- The config is hardcoded and public by design. The guards are App Check, `storage.rules` and the
  `@auth` level on every Data Connect operation
- Development always talks to the emulators, `bun run preview` too, through
  `VITE_USE_FIREBASE_EMULATORS=true`, since its bundle is a production build
- **A Hosting preview channel writes real data**: there is one Firebase project, so signing in on a
  preview creates a real account. Look at what renders there, never exercise sign-up. Isolating it
  would take a second project with its own Cloud SQL instance, a decision nobody has taken yet. Its
  App Check debug token, printed on first run, has to be registered in the console first; the
  emulators enforce no App Check
- **App Check enforcement is a console setting**, switched on per service. Until it is, nothing
  rejects a request without a token, and the sign-in screen's `PUBLIC` email lookup enumerates
  addresses to any caller: switch it on for Data Connect and Storage before the project is public
- **Storage lets another origin read a file's bytes only as `storage.cors.json` allows**, which the
  build in public page's PNG export needs. It is a bucket setting no deploy sends: after changing
  the file, run `gcloud storage buckets update gs://strategydance.firebasestorage.app
  --cors-file=storage.cors.json`. A preview channel's origin is not listed
- **Storage deletes what waits under `pending/` after two days**, as `storage.lifecycle.json` says,
  so a draft's files never sent cost nothing for long. Also a bucket setting: `gcloud storage
  buckets update gs://strategydance.firebasestorage.app --lifecycle-file=storage.lifecycle.json`
- **The Storage emulator applies no rule and ignores generation preconditions**: code relying on
  `ifGenerationMatch: 0`, as a conversation's files do, reads what is there first, and its tests
  simulate the 412 on a fake

### The database

Schema and operations live in `packages/strategydance-database`, and the generated SDK is the only
way the app talks to them.

- One connector per caller, since `@auth` levels differ by who asks and the web bundle should carry
  no server operation: `strategydance-web-connector` for the browser, and
  `strategydance-backend-connector` for the backend, generated as an Admin SDK, every operation
  `NO_ACCESS`. The backend passes the uid it verified as a variable, never one a client sent, and
  each operation still checks it against the rows it touches
- Every operation carries an `@auth` level, and `USER` keys off `auth.uid`. The one `PUBLIC`
  operation is the sign-in screen's email lookup. The authorization server's backend operations
  find a client, a request, a code or a token by its id or its hash before any `$userId` is
  verified, since holding that random value is what OAuth trusts, and only hashes are stored; so
  does a Connect's callback (`GetIntegrationAuthorizationByState`)
- An operation that finds its row by `auth.token.email`, as the invitations do, is
  `USER_EMAIL_VERIFIED`, since a password sign-up can name any unclaimed address. A tab that just
  saw the address confirmed mints a new ID token, as `refetch` on `AuthenticationContext` does.
  Locally the Auth emulator prints the confirmation link in its log
- Server values over variables wherever the server knows better: `id_expr: "auth.uid"`,
  `email_expr: "auth.token.email"`, `updatedAt_expr: "request.time"`
- A table references the account and the organization apart, so removing a member, which deletes
  the membership alone, keeps what they wrote. A connection is the membership's and goes with it,
  its tokens too: `AgentConnection`, `IntegrationConnection` and `IntegrationAuthorization`. Data
  Connect cannot reference a key made of references, so `UserOrganization` names its `userId` and
  `organizationId` columns, and a reference names them with `@ref`, its constraint named under
  Postgres' 63 bytes
- `Organization.slug` leads its pages' paths: drawn at creation from the name and four random
  characters (`createOrganizationSlug`), unique, never changed, so a link outlives a rename. An
  organization from before slugs has none and is addressed by its id. The UUID stays the key
  everywhere else
- An operation gains a variable without a breaking connector change by making it optional, which an
  older page leaves out. A `@check` on it reads `!has(vars.state) || vars.state == null || …`, since
  `vars.state == null` alone errors on an absent variable
- The ids a route hands an operation are canonical (`toCanonicalUuid`): a live query's refresh
  condition compares variables as text, so a hyphenated id refreshes no other tab
- `Locale` is declared in both `schema.gql` and strategydance-core, which `schema.test.ts` keeps
  agreeing: add a locale to both. Every other enum lives in `schema.gql` alone, imported by the
  frontend from `strategydance-database/web`
- An enum's order is the Postgres enum's: append a value, never reorder. The aspects' display order
  is `COMPANY_ASPECTS` in the web's `constants.ts`, which `constants.test.ts` holds to the enum
- A schema change reaches production with its release, Data Connect before what queries it, and a
  migration that drops anything stops the release for a human
  ([What a merge into `main` deploys](#what-a-merge-into-main-deploys))

What Data Connect does, found the hard way:

- The generated SDKs cannot pass a `_Data` list variable, so nothing batch inserts: the backend
  calls a single-row mutation once per row
- A level of a `where` holds plain fields or `_and`, `_or` and `_not`, never both: the plain fields
  go in an `_and` entry of their own
- An operation takes no `@check` of its own: a check on variables alone sits on a field of the
  first, redacted step
- A mutation runs as one SQL statement, unless a step reads an earlier step's `response`, when each
  step runs as a statement of its own. One statement reads one snapshot, so a step after a lock
  misses what the lock's holder committed meanwhile, and only a condition in an update's `where` is
  checked again, on the row as it stands. So a step that counts, or writes rows it finds by
  a filter, after a lock another writer takes, reads the lock's response, as the starts' membership
  reads `response.userOrganization_update.userId` (M41). A step running apart sees what its mutation
  wrote before it, and one statement does not, so count around the rows a mutation writes by their
  ids. The mutations outside conversations still count in one statement
- A mutation takes one `query` step. A check that has to follow a write goes there, after it, as
  `FoldDocumentForAgent`'s does, and a refusal there rolls back the writes before it
- A `@check` under a list that comes back empty is never invoked, and Data Connect refuses with that
  check's message rather than the list's: a variable's check nested under a write's membership takes
  `optional: true`, so a removed member gets the membership's message
- `@include(if: $flag)` skips a step, but its variables stay required and a key it names is refused
  null: a step whose key a call may lack is an operation of its own, as `RecordOAuthClientUse` is
- A foreign key a later step violates is reported before an earlier step's `@check`: the backend
  reads both messages as one refusal (`isMembershipRefusal`, `isConnectionGoneRefusal`)
- A mutation writes each row once: in one statement a later write to a row written earlier is
  silently skipped, aliased or not. When the row a mutation locks is the row it writes, the write is
  the lock, and the checks follow it
- A request takes 4 MiB at most, which the emulator names when one passes it
- The generator declares an enum only when an operation of the connector selects a field of that
  type at its top level, and `tsc` misses one selected only nested, past `skipLibCheck`
- A filter on an optional list variable left out is dropped and matches every row: a write filtered
  so counts its rows against the list (`this == size(vars.attachmentIds)`), which
  `check:conversation-attachments` checks
- A nullable variable left out of a write leaves its column alone, and only null clears it, so a
  write meant to clear a column passes null, which `createIntegrationDatabaseFake` holds the backend
  to
- An emulator runs one operation at a time on any database, its PGlite or a real Postgres, so no
  race shows through one: a lock's reasoning is Postgres', which `bun run check:conversation-races`
  tests with four emulators on one Postgres behind a proxy (`withPostgresEmulators.ts`)

A list a page keeps current is a live query: `@refresh(onMutationExecuted: ...)` names each mutation
that changes it, with a condition on the variable they share, so every mutation it listens to takes
that variable. A mutation the backend runs through the Admin SDK fires it too. The frontend
subscribes beside its first read and writes each pushed result into the TanStack cache: copy
`useOrganizationTeam`.

- Read a query that takes variables through `useQuery` and `executeQuery`, never the generated
  hook, which reads the old variables' data into the new key on the render they change
- A query a waiter and its page both read sets `retryOnMount: false` and tells a failed read from an
  empty one (`hasFailed`), or a retry unmounts the page and its mount retries it, forever
- Agent connections: a member reads and disconnects their own through `GetAgentConnections`, live,
  and `DeleteAgentConnection`, and an operation that makes or deletes a connection, a membership's
  included, names itself in its refreshes; the `lastUsedAt` write never does. Allow holds a member
  to `MAX_AGENT_CONNECTIONS`, counted under a lock on the member's row, and the list reads that many.
  That count still reads its statement's snapshot, until the pull request after M41 reads the lock's
  response; `check:oauth` guards the outcome
- Organizations' MCP servers, `OrganizationIntegration`, are the backend's to write. An edit carries
  the name, `configRevision` and `keyGeneration` its dialog showed, and an approval the revision its
  tools were shown under, so a change made meanwhile wins over a stale view; approvals are added and
  removed by hash, never rewritten. `GetOrganizationIntegrations`, live, never selects the key's
  ciphertext nor the tools, which `GetOrganizationIntegrationTools` reads for one dialog: a write
  that changes what either selects names itself in their refreshes, and `lastUsedAt` never does.
  `bun run check:integrations` checks the operations
- A member's account at an OAuth server is an `IntegrationConnection`, and a Connect under way an
  `IntegrationAuthorization`, both the backend's. Tokens, codes and verifiers are encrypted, bound
  to their purpose, server and member (`buildIntegrationSecretContext`), and no web operation selects
  one: the page reads `GetIntegrationConnections`, live, which no refresh of the tokens wakes. A
  connection, one per member and server, takes a fresh UUID as its `generation` at each connect,
  kept by a refresh. A refresh leases the connection (`refreshingUntil`, on the database's clock)
  only while it holds the refresh token its caller read, so a rotating token is spent once, and
  writes and lets go by the lease's id alone. A member's write on the server's row, a Connect's start
  or its connection, locks the row at the revision and issuer it started under, and
  `ReconfigureOrganizationIntegration` and `ChangeOrganizationIntegrationIssuer` write the row
  before deleting its connections and Connects, so under read committed none outlives them: an order
  a change keeps

A knowledge document's text is a Yjs document, so several members write it at once.
`Document.state` holds its snapshot in base64, the source of truth, each `DocumentUpdate` row an edit
pushed since, and `content` a copy each compaction writes. `createKnowledgeDocumentSync` pushes the
reader's edits, merges what `GetLiveDocument` pushes, which leaves the snapshot out, and compacts
through `CompactDocumentWithText`, guarded by `revision`. `DocumentPresence` rows, one per open tab,
place the carets (`GetDocumentPresences`).

- Every write of `content` writes its plain text beside it, `contentText`, which the Knowledge
  module's search reads. `CreateDocument`, `CompactDocument` and `UpdateDocumentContent` stay for
  older pages and write null, which means not indexed yet: a new way to write `content` writes
  `contentText` too, or nulls it
- Anything that writes the text, an agent included, writes it through Yjs: once a document has a
  snapshot, a write to `content` alone is refused. The backend reads and writes it through
  `domain/knowledge/` alone
- Outside an editor the text is written as a difference, through the design system's
  `updateRichTextYDoc`, never as a document rebuilt from blocks, which merges as a second copy. It
  keeps the nodes y-prosemirror's read produced: blocks matched by equality alone can pair an
  untouched block with a new one and delete whatever somebody typed in it
- An agent's edit keeps the text it replaced as a `DocumentRevision`, in the mutation that stores the
  edit (`FoldDocumentWithRevisionForAgent`), with a fingerprint of the text it left
  (`fingerprintKnowledgeDocumentText`), and a new `…ForAgent` text write keeps one the same way.
  Members alone read revisions and restore one through the backend, as a difference. An Undo goes
  back only while the text keeps that fingerprint, which hashes everything y-prosemirror reads, never
  the Markdown. Revisions last 30 days (`DOCUMENT_REVISION_LIFETIME_DAYS`)
- A knowledge write carries the text twice and can pass the 4 MiB: it is measured first
  (`isKnowledgeWriteTooLarge`) and refused, never written without its revision
- The editor's schema keeps the text to what it knows: a tab on an older bundle deletes a block
  type, inline type or style its schema lacks from the shared text, a style taking its whole block.
  So a new one reaches every tab before anybody can write it, unless David chooses to ship it with
  the release that writes it, as he did mentions and inline code. A node's props are append-only.
  The Yjs helpers read with a schema too, `RICH_TEXT_EDITOR_BLOCKS` unless told another: a
  document's editor and its helpers keep to one list
- A mutation cut off midway, as a closing tab cuts it, can wedge the Data Connect emulator in its
  transaction until it restarts, so a document's page folds nothing as it goes away and sends only
  writes that are no transaction (`PushDocumentUpdate`, `UpdateDocumentPresence`, `LeaveDocument`)

What a conversation keeps, and how, is in [Conversation conventions](#conversation-conventions).

- The build in public page counts a streak from `ActivityDay` rows, one per member, organization and
  day they changed their Today data or the team's board, held by `RecordActivity` to the caller's
  today. The web app calls `recordActivity` once such a change goes through, from `useChecklist`'s
  and `useTaskChanges`' `change` helpers and the priority and log components: a new way to change
  either calls it too. No agent's change counts
- The board's `Task` rows sit in a column per `TaskStatus`, any member changing any task. Each field
  has its own mutation, so two members keep each other's changes, and a move writes the one task,
  halfway between its new neighbours. A move into Done goes through `FinishTask`, which stamps
  `doneAt`, and a new way to finish a task stamps it too. A move names the column it saw the task in
  (`$fromStatus`) and is refused once the task has left it. `TaskDependency` links a task to those
  it waits on: the server refuses a task waiting on itself or on one waiting on it, and the page
  offers no pick, nor Undo, that would close a longer loop
- The board keeps `GetTasks` live without the descriptions, which its search reads through
  `GetTaskDescriptions`, and a task's dialog keeps its own live (`GetTaskDescription`), writable once
  that read lands. Removing a member takes them off their tasks
- Every write of a description writes `descriptionText` beside it, which `list_tasks` matches.
  `CreateTask` and `UpdateTaskDescription` stay for older pages and write null: a new way to write a
  description writes it too, or nulls it. `RestoreTask` refuses a task deleted over a day ago,
  pruned or not

### Routing

- The authenticated area is the pathless `src/routes/_authenticated.tsx`, so its pages share the
  root with the public ones and take names none of them has: two static routes at one path fail the
  build ("Conflicting configuration paths")
- An organization's pages sit under `$organizationSlug`, its slug or its id while it has none. A
  static route outranks it silently, so no page at the root may be named like a slug, which always
  ends in a dash and four letters or digits: `routeTree.test.ts` fails the day one is. Any other
  `$param` stays off the root. A first segment that can be neither a slug nor an id is the not found
  page, before anything asks the reader to sign in
- The path says which organization is current. `_CurrentOrganizationProvider` reads it and
  remembers the last one, for the pages outside any organization and for `/today`, where every "go
  home" leads. A link takes its segment from `useCurrentOrganizationSlug`, switching is a navigation
  to the same page in the other organization (`useSwitchOrganization`), and
  `CurrentOrganizationBouncer` decides a path naming an organization the reader is not in, or one
  gone while its page is open
- The consent page, `/oauth/consent?request=<id>`, and the page an OAuth MCP server's sign-in ends
  on, `/integrations/connected` (`INTEGRATION_CONNECTED_PATH`), sit under `_authenticated` outside
  `_app`: full screen, never sent to the prologue. `firebase.json` sends `frame-ancestors 'none'` and
  `X-Frame-Options: DENY` under `/oauth` and `/integrations`, matched case-insensitively, since the
  router ignores case. The consent page reads its request once, never again on focus, reconnecting
  or retry: a read has the backend fetch the client's metadata, and one after the decision finds the
  request gone
- `useIntegrationConnect` opens the sign-in window blank inside the click and nulls its `opener`
  before sending it to an https address. It takes the `BroadcastChannel`'s `connected`
  (`INTEGRATION_CONNECTION_CHANNEL`) as a nudge and the reader's live connection appearing as the
  proof, and never reads the window's `closed`, which a Cross-Origin-Opener-Policy makes read true
- TanStack parses each query value as JSON before `validateSearch` sees it, so 32 hex digits that
  are decimal arrive as a number: an id the backend writes into an address is hyphenated
  (`toHyphenatedUuid`), and `validateSearch` takes a string alone
- A `validateSearch` that leaves a key out does not remove it, since TanStack lays its result over
  the raw query: overwrite a key that fails with `undefined`, above all one that is followed
- No path prefix marks a page as authenticated: `isAuthenticationPath` in `~utils/authentication`
  says whether a path is a sign-in screen
- The page a signed-out reader asked for is kept in localStorage, never in the sign-in screen's
  URL: `AuthenticationBouncer` keeps it, `AuthenticationRedirect` returns them there within the
  hour, and the bouncer forgets it on the next page of the app. A new way in from the sign-in screen
  goes through a page that mounts the bouncer
- An address nothing matches, and any `notFound()`, render `NotFound` full screen, the root's
  `notFoundComponent`, with its strings in `global`, the one catalogue the root registers. A route
  that sets its own catches its pages first
- `firebase.json` redirects `/-/<path>` to `/<path>` with a 301, for invitation emails sent when the
  app lived there: a `regex`, since the Hosting emulator's `:path*` matches one segment, whose
  capture starts with a letter or a digit, or `/-//evil.example` would send a browser to another host
- `<Navigate>` navigates again whenever its props change, so fed the location it redirects to its
  own redirect: navigate from an effect on the verdict, reading the location off the router, as
  `AuthenticationBouncer` does

### Internationalization

- User-facing strings go in `src/data/intl/messages/*.ts`, never hardcoded in a component. Ids are
  dotted `<messageType>.<path>` and unique across every message file
- A new message type needs its source module, an entry in `MESSAGE_TYPES`, and an
  `IntlMessagesRegistration` on the route that needs it
- **Never edit `src/data/intl/messages-translated/` by hand**: `bun run translate` alone writes it
- **Run `bun run translate` whenever a message changes**, and commit the locale files with
  `translations.lock.json`, which records a hash per id, so only new or edited strings reach Gemini.
  A branch that skips it ships six locales that silently render English. Deleting the lock, a locale
  file or one entry forces a retranslation
- **Never write an em dash in a `defaultMessage` or a `description`**: use a full stop, a comma or
  a colon. It reads as machine-written, and all six locales inherit it

## Backend conventions

`packages/strategydance-backend` follows sunshine's backend, trimmed: one router per resource in
`routes/`, the Express middleware in `middleware/`, what a route does in `domain/`, helpers in
`utils/`, one concern per file.

- Rich text, its Yjs helpers and its Markdown come from the design system's `lib/`
  (`strategydance-design-system/lib/*`), never a component, with `yjs` at the design system's range
  so one copy resolves, since the helpers test their types with `instanceof`. The backend's `tsc`
  follows them into code that builds elements, so its `lib` takes DOM, and the emails' with it
- Every answer is strategydance-core's `ApiResponse` envelope, and every refusal goes through
  `respondError` with an `ERROR_CODE_*`. The web calls the backend through `requestApi` in
  `~data/api`, which throws an `ApiError` carrying `Retry-After` as `retryAfterMs`. A file goes up
  through `uploadApiFile`, on `XMLHttpRequest` for its progress, and comes back through
  `requestApiFile`, never an `<img>` pointed at the backend, which carries no token
- No body parser is applied app wide: a route parses its own, then runs `appCheckMiddleware`,
  `authenticationMiddleware` and `validateMiddleware`, and reads its caller with `readViewer`. A
  route taking a file parses last, after whatever says the caller may send it
- The image runs as two services, built by `createApp` in `src/app.ts`: the public backend,
  `strategydance-backend`, and the private worker, `strategydance-worker` (`SERVICE=worker`,
  `IS_WORKER`), which mounts `routes/internal.ts` at `/internal` and nothing else. A route Cloud
  Tasks or Cloud Scheduler calls goes there
- The worker keeps Cloud Run's invoker check,
  `conversation-tasks@strategydance.iam.gserviceaccount.com`, the account Cloud Tasks and Cloud
  Scheduler call it as, holding `roles/run.invoker` on it alone, so no internal route verifies a
  token by hand. Its timeout is fifteen minutes and its concurrency four, and its address is Cloud
  Run's deterministic one, `WORKER_URL`, also the token's audience
- Credentials are Application Default Credentials. Both services run as the Compute Engine default
  service account, which also builds them and, since the organization withholds the Editor role,
  needs `roles/run.builder`, `roles/firebasedataconnect.dataAdmin`, `roles/storage.objectAdmin` on
  the bucket, `roles/cloudtasks.enqueuer` and `roles/cloudtasks.viewer`,
  `roles/iam.serviceAccountUser` on `conversation-tasks`, and Secret Manager's accessor role on each
  secret it reads. `dev:backend` points at the emulators and skips App Check
- `deploy` makes the backend public with `--no-invoker-iam-check`, never `--allow-unauthenticated`,
  whose `allUsers` the organization's domain restricted sharing refuses: each route's middleware
  guards it. A push to `main` deploys both services, and `.gcloudignore` leaves the job's
  `gha-creds-*.json` out of the image
- What only an administrator or a member may store is the backend's to write, since a Storage rule
  cannot read who administers what: `storage.rules` grants clients nothing under `organizations/`
  - An organization's logo or banner is stored under a fresh name with its own download token, the
    file before it deleted. A logo arrives with the thumbnail the page drew
    (`createImageThumbnail`), stored as `logoThumbnailUrl`, and a profile picture's thumbnail is the
    page's to write, as `imageThumbnailUrl`. The organization switcher, the user menu and the
    board's faces draw the thumbnail, falling back to the picture; the other small faces still draw
    the picture
  - A picture of a document's text, under `organizations/<id>/rich-text/`, goes only with its
    organization: an undo or another tab can bring a deleted one back
  - A conversation's file has no download token: the backend serves it (`GET
    …/attachments/:attachmentId`), checking the reader is still a member. An upload streams into
    `pending/{organizationId}/{userId}/{id}`, create-only, through a check of its signature and
    `Content-Length`, and a send copies it under its conversation. Every id in an object's name is
    canonical (`toCanonicalUuid`). `conversationAttachmentStorage` is the one module touching the
    bucket for them, and a test that mocks `~firebase` mocks it with `createAttachmentStorageFake`
  - An upload reads its file back one at a time, then collects the heap whole (`Bun.gc(true)`), or
    twenty files of 10 MiB take a backend past Cloud Run's 512 MiB: run `bun run
    load:conversation-attachments <email>`, in the backend's package, after changing what an upload
    reads, holds or sends
- Documents' revisions are read and restored through `routes/knowledge.ts`, which merges a whole
  document in the instance, so a member makes 60 calls in ten minutes at most
  (`knowledgeRevisionRateLimitMiddleware`)
- A request to an address somebody else gave goes through the outbound guard in `utils/`, never
  `fetch`: `requestOutbound`, one request, http or https on its own port, https alone where the
  caller says, to a hostname that is no name of this server's own network and public addresses alone
  (`isGloballyRoutableAddress`), pinned to the address checked, a redirect answered rather than
  followed; `fetchOutbound`, following redirects through it within a deadline and a byte cap; and
  `createGuardedFetch`, the MCP SDK's `fetch`, https alone, following a same-origin redirect alone,
  so a key never leaves its server. A refusal names the origin alone, never a path or a query
- Every email goes out through `sendEmails` in `domain/email/`, over Resend's batch endpoint, from
  `david@strategydance.com`, which has to stay verified in Resend and receive mail, since the
  welcome email asks for a reply. The key is the `resend-api-key` secret, read through
  `retrieveSecret`, cached for the process, so a rotated key takes effect with the next revision; a
  secret read by version, as `oauth-token-secret` is, goes through `retrieveSecretVersion`. Only
  production sends: elsewhere the HTML lands in the OS temp directory and each invitation's link in
  the log, which is how an invitation is accepted locally
- An organization's MCP servers are its administrators' to change, through `routes/integrations.ts`,
  every route behind `organizationAdministratorMiddleware` and those that reach a server behind
  `integrationRateLimitMiddleware`. `reachIntegration` (`domain/integrations/`) lists a server's
  tools, a 2025 handshake first, or discovers an OAuth server's issuer, which has to offer S256 and
  a way to register, a server's origin taken as its authorization server only when every metadata
  address answered 404. Nothing is saved when a server cannot be reached. A failure is an
  `IntegrationFailure` of one of the database's `IntegrationError` kinds, answered with its code
  (`INTEGRATION_FAILURE_ERROR_CODES`). A key is encrypted with Cloud KMS in production
  (`INTEGRATION_KMS_KEY_NAME`, on which the runtime account holds
  `roles/cloudkms.cryptoKeyEncrypterDecrypter`), under a fixed local key elsewhere, bound to its
  organization and server, and read back only to reach the server again. A log or a refusal names a
  server's origin alone, never what it answered. The routes' tests run against
  `createIntegrationDatabaseFake`, `bun run check:integrations` checks the operations, and `bun run
  probe:integrations` reaches every catalogued server
- Any member connects their own account to an OAuth server through the same router's
  `…/:integrationId/connection` routes, behind `organizationMemberMiddleware`. Strategy Dance is the
  OAuth client, every request through `createIntegrationFetch`, with the MCP SDK's
  `registerClient`, `startAuthorization`, `exchangeAuthorization` and `refreshAuthorization`, never
  its `auth()`. It presents its client ID metadata document (`GET /integrations/oauth/client`) where
  the server reads one, else the dynamic registration recorded on the server's row. The callback,
  `GET /integrations/oauth/callback` (`routes/integrationOAuth.ts`), finds the Connect by its state's
  hash, keeps the code encrypted for two minutes and redirects to the app's page, which finishes it
  as the signed-in member, for the account that started it alone (OAuth CSRF). A token is read
  through `readIntegrationAccessToken`, refreshed under the connection's lease, and goes only to the
  address of the revision it was given for. Nothing logs a code,
  state, token or server's answer, though Cloud Run's request log keeps the callback's query unless
  step 12 of conversations.md's setup excludes it. The tests run the real SDK against
  `createIntegrationOAuthServerFake`
- The worker's `POST /internal/sweep`, daily, first reconciles the runs nobody did, then removes
  what stays deleted past its Undo window and prunes what expires: conversations deleted over a day
  ago, claimed first, so a restore refuses them, and deleted with their files and module call
  results, one whose files could not all go staying claimed for the next sweep; files never sent; the
  board's deleted tasks; deleted documents and MCP servers; revisions over 30 days old; and the
  expired Connects, searches, run spends, call results and the authorization server's requests and
  tokens. Each step runs whatever failed before it (`runSweepSteps`), and the route answers 500
  naming the failures. `RestoreConversation` refuses a conversation deleted over a day ago whether
  or not the sweep has run. Something kept deleted, or counted, for a while adds its idempotent prune
  there
- The worker's `POST /internal/runs-reconcile`, every five minutes, reconciles the runs no page
  watches: subagent runs past their lease or waiting for a slot (`sweepSubagentRuns`), members' runs
  past their lease (`sweepDeadConversationRuns`), and reactions no run's end started
  (`sweepSubagentReactions`), each going on past its failures and throwing `SweepIncomplete` once
  done. A new kind of run no page watches is reconciled there too
- The worker's `POST /internal/directories-check`, daily, commits a day's check to one rolling pull
  request into `dev`, from `directories-check`, which only it writes (`publishDirectoryCheck`). It
  reaches GitHub as a GitHub App (`github-app-id`, `github-app-private-key`, through
  `domain/github/`), since a pull request opened with Actions' token runs no CI. It runs the last
  release's code on `dev`'s lists, so `readDirectoryLists` refuses a field or value it does not know
  rather than write the lists back without it.
  [directories.md](documents/directories.md) has the rest
- Strategy Dance's OAuth authorization server, which external agents reach a module through, is the
  public backend's: `routes/oauth.ts` (`register`, `authorize`, `token`, `revoke`), the consent
  page's `routes/oauthRequests.ts`, `routes/wellKnown.ts`, and `domain/oauth/`. The protocol's
  endpoints answer OAuth's own JSON (`respondOAuthError`), carry no App Check, answer any origin
  without credentials (`OAUTH_PROTOCOL_PATHS`, matched exactly), never log a body, find tokens by
  their hash, and are metered per address, registration and authorization capped in all too, and
  the token and revocation endpoints generously, since a hosted client calls them for every member
  from a few addresses of its own. The consent page's routes keep the app's middleware, App Check and
  the ID token, and are the only place a client ID metadata document is fetched, once a member has
  signed in. A module's endpoint checks its token with
  `createAgentConnectionTokenVerifier`. The tests run against `createOAuthDatabaseFake`, and `bun
  run check:oauth` goes through the whole flow against the local backend: an operation changed is
  changed in both
- The modules' endpoints, `routes/modules.ts` at `/mcp` (`MODULES_PATH`) on the public backend,
  serve each of strategydance-core's `SERVED_MODULES`, `POST` alone, through the SDK's
  `toNodeHandler`, answering JSON-RPC (`respondJsonRpcError` before the handler) and carrying no App
  Check: the bearer token is the guard. In order: 405 on another method; 403 on an `Origin` other
  than the app's (`originValidation`, against DNS rebinding), a request without one passing;
  `moduleAddressRateLimitMiddleware`, counting refusals alone; `requireBearerAuth` with the
  endpoint's `expectedResource`; `moduleRateLimitMiddleware`; then the body, 1 MiB at most, parsed
  only once the token is verified and handed over whole, `(request, response) =>
  nodeHandler(request, response, request.body)`, since the parser consumed the stream. They answer
  the app's origins alone, no browser client being served yet. Each module's protected resource
  metadata is `routes/moduleMetadata.ts`, mounted at the app's root, its path in
  `OAUTH_PROTOCOL_PATHS`. A 2025 client is served statelessly over SSE

## Conversation conventions

A conversation is a member's exchange with Strategy Dance's agent in one of their organizations:
its runs, which the worker takes, the subagents its agent launches, and the modules and
integrations it calls. [conversations.md](documents/conversations.md) says what each part does and
why, and [conversations-milestones.md](documents/conversations-milestones.md) how each was built:
read the first before changing any of it.

### A run

```text
member's action ─▶ route ─▶ run QUEUED, activeRunId set, task queued ─▶ 202
worker: claim (RUNNING, lease) ─▶ loop: request Claude ▸ store the turn ▸ draw it ▸ run its calls ─▶ end
end: COMPLETED │ WAITING │ STOPPED │ FAILED │ REFUSED │ INTERRUPTED, activeRunId let go
later: WAITING ─▶ CONTINUED, once an answer or a send consumes its turn
```

- A run is triggered by a member's `MESSAGE`, `ANSWER`, `RESUME` or `RETRY`, a subagent's by its
  `LAUNCH` or its chain's `CONTINUE`, and a parent's reaction to its subagents' reports by
  `REPORTS`. `PENDING` and `CHAINED` are a subagent's alone
- One run goes at a time in a conversation: the first send inserts the conversation with its
  `activeRunId` set, and every later start takes the row with a `conversation_updateMany` on
  `activeRunId: { isNull: true }` under `@check(this == 1)`, refused with
  `ERROR_CODE_CONVERSATION_BUSY`. A member has three runs in flight in an organization
  (`MAX_ACTIVE_RUNS_PER_MEMBER`), counted under their membership's lock once their dead runs are
  finalized
- The worker claims a run `QUEUED`, or `RUNNING` past its lease, adding one to `attempts`, which
  each of its later writes is fenced on, and answers Cloud Tasks 200 once the run is finished, 503
  while another worker holds it
- A run's limits are the backend's: 25 requests (`CONVERSATION_RUN_MAX_REQUESTS`), 10 minutes from
  its first claim (`CONVERSATION_RUN_MAX_DURATION_MS`), a stream cut 14 minutes after the claim, 60
  seconds a call, $10, and the member's daily spend ceilings. A conversation holds 2000 entries and
  a run draws 100. Each is checked before a request, never after, so a turn paid for is always
  stored and drawn, and a run at a limit ends `FAILED` with its note
- The loop is the worker's own, never the SDK's tool runner, since a run stops for an answer and
  writes each step as it happens. By `stop_reason`: `end_turn` completes; `tool_use` runs the calls,
  stores one `USER` entry with every result in the turn's order and goes round again, a turn holding
  `ask_user` ending `WAITING` with its other results kept in `pendingToolResults`; `pause_turn`
  sends the turn back, five times at most; `max_tokens` runs nothing and fails; `refusal` runs again
  on the fallback model, ending `REFUSED` if it survives
- A request refused before its stream starts (rate limited, overloaded, failing, unreachable) costs
  nothing and is sent again, after its `retry-after` or a doubling delay, four times in a row at most
  (`MAX_CONVERSATION_API_RETRIES`). Any other error of the API fails the run with its note
- Every write that ends a run cancels the calls still `RUNNING` in its conversation, and lets go of
  `activeRunId` where it still names the run, in the same write

### The transcript

- `checkTranscript` (`domain/agent/`) checks every request, and every entry a route adds, against
  what Claude refuses: the first entry is `USER`; a `SYSTEM` entry sits between a `USER` and an
  `ASSISTANT` one, and last only as a request's unstored context message; an `ASSISTANT` entry's
  `tool_use` blocks are answered by a `USER` entry opening with one `tool_result` per call, in their
  order; so only the last entry holds calls with no result. A `server_tool_use` carries its result
  within its turn
- A run's context message is built when the run starts, sent last and unstored until its first turn
  lands, then stored with it in one mutation. Its profile part goes only when its hash differs from
  the `contextHash` of the last context message still in the transcript
- The `USER` entry answering a turn always comes from `buildConversationToolResults`: one result per
  call in the turn's order (`STOPPED_CALL_RESULT`, `INTERRUPTED_CALL_RESULT` unless its write's key
  holds one, `SKIPPED_QUESTION_RESULT`), then the subagents' reports waiting, then the member's
  files and text
- A turn a fallback model finished is stored without what the declining model wrote before its
  boundary: its thinking, `tool_use` and unpaired `server_tool_use` blocks

### A new tool

A tool the agent calls is its own, a module's or an integration's. Every tool takes:

- a description saying when to call it, which is what the model decides by, and its running and
  done labels in the `conversation` catalogue, in `getConversationToolLabel`, whose test names every
  tool
- a JSON result, cut at `MAX_TOOL_RESULT_LENGTH` (50000 characters), a long read paging itself well
  short of it, and a failure answered `is_error: true` with a sentence the model can act on, never
  one that fails the run
- `eager_input_streaming: true` (`CONVERSATION_TOOLS`, `toConversationModuleTool`), its input
  checked before it runs, since it streams in unchecked
- a place within ten calls a turn and fifty a run (`MAX_TOOL_CALLS_PER_TURN`,
  `MAX_TOOL_CALLS_PER_RUN`): a call past either is drawn failed and never runs
- whether it only reads, which a module's says with `readOnlyHint`: reads run four at a time, a
  write or an integration call alone, in Claude's order. A tool reads only when running it twice
  changes nothing
- whether a subagent gets it: `isSubagentTool` withholds the deletes and the Subagents module's
  tools, and `buildSubagentTools` withholds `ask_user`, so a new tool that deletes or reaches
  subagents joins them
- its bytes pinned: the tool lists' tests move with it, the release costs every conversation its
  earlier reasoning once (`drop_block`), and `bun run probe:claude` runs after, since a list the API
  refuses fails every run

The agent's own tools, in `CONVERSATION_TOOLS`, are strict, within a request's 20 strict tools, 24
optional and 16 union parameters (`buildConversationTools.test.ts`), each run by a
`ConversationToolRunner`. A module's are registered by its server, as
[Module conventions](#module-conventions) says, after them and not strict. Past some 10000 tokens of
definitions Claude's tool search (`defer_loading`) takes over, and the list held 16017 from M33, so
a module added later weighs it (conversations.md § Modules). An integration adds none: integrations
reach the agent through three fixed tools, so the list never varies.

### The data

A conversation is kept twice, the transcript for Claude and the thread for the page.

- A file a member sends is a `ConversationAttachment`, uploaded before its message, into a draft's
  conversation as often as a saved one's, so its `conversationId` is a UUID nothing reserves: every
  lookup, count and prune also matches `userId` and `organizationId`. It goes `UPLOADING`, reserved
  under the membership's lock, then `READY`, or `PRUNING` once a prune claims it. The transcript
  holds it by its Files API id, and a conversation's prune deletes its files' rows before its own
- The transcript, `ConversationTranscriptEntry`, holds the exact content blocks of every turn,
  thinking and signatures included, and only the backend touches it. It is append-only, but for
  Retry cutting the tail back to a run's anchor, since Claude refuses a history changed under its
  thinking. An entry's `content`, a run's `context` and its `pendingToolResults` are `String`
  columns of JSON text, never `Any`, which Postgres' `jsonb` would rewrite, so it replays byte for
  byte
- A run's `usage` is a ledger (`conversationRunUsage`): each request is reserved at its measured
  input before it is sent, in the fenced lease renewal (`RecordConversationRunUsage`), and settled
  from its answer. A worker taking over charges an unsettled request at its estimate. What a request
  came to is kept until written, so a refused write is tried again and never paid twice. Every write
  of `usage` upserts the run's `RunSpend` beside it (`toConversationUsageVariables`), which the
  fake's `unpricedLedgerWrites` holds the tests to; `RenewConversationRunLease` carries none. A side
  request, today the aspects' tagging (`requestConversationTagging`), goes through the ledger with
  its `purpose` and no `turnPosition`, is tried once a run and never fails it. An aspects note,
  the agent's or the member's, belongs to no run, so it counts toward no run's entries and a Retry
  keeps it
- A run stops at $10 (`CONVERSATION_RUN_MAX_COST_MICRODOLLARS`), held before each request: the ledger
  at list prices, each unsettled request at its worst case (`priceConversationUsageBound`), plus the
  worst the next request can cost (`priceRequestWorstCase`). A request whose fallback would pass a
  limit goes without `fallbacks`, and one that cannot fit fails the run, a subagent's chaining at the
  $10. A cut stream counts at the most its model could write in the time it streamed
  (`priceCutRequestBound`). A model a request names, or falls back to, joins `CLAUDE_MODEL_PRICES`
  and `CLAUDE_FALLBACK_MODELS` before it ships, with `bun run probe:claude` after
- Daily caps bound what a member starts (`MAX_DAILY_…` in strategydance-core): conversations, runs
  and subagents in 24 hours, per member in an organization, per account and per organization,
  counted on `CappedStart` rows that hold their organization as a plain id. A conversation's start,
  every run triggered `MESSAGE`, `ANSWER`, `RESUME`, `RETRY` or `REPORTS`, and a launch count, never
  a subagent's own runs: each mutation counts in its one query step, after the membership's lock,
  and inserts its row last. Its domain function reads the counts first (`readReachedUsageCap`),
  after recognizing an action sent again, and a refusal of its mutation reads them again; a route
  answers 429 with the cap's code and `Retry-After` (`respondUsageCapped`). An answer's
  continuation, an Allow and a reaction pass a cap up to one and a half times it, then wait. A new
  way to start a conversation, a run or a subagent counts the same way. The development backend
  lifts them (`IS_USAGE_CAPPED`, held by `USAGE_CAPPED=true`) through each mutation's optional
  `$isUsageCapped`, which left out holds them, as the tests and checks leave it: a test or a check
  that builds past a cap lifts it in its fixtures
- Daily spend ceilings, $25, $50 and $150 (`MAX_DAILY_SPEND_MICRODOLLARS_…`), over the caps' 24
  hours and scopes, are summed from `RunSpend` rows. The worker holds every request to them beside
  the $10 (`readRunSpendRoom`), and every start is held to them beside the caps: a send, Resume and
  Retry answer 429, a continuation and a reaction wait, a launch is refused, a promotion leaves its
  runs pending and a chain ends its subagent with its report. A run a ceiling stops fails with a
  note naming it and when it frees (`ceilingScope`, `ceilingFreesAt`). A new way to start, promote
  or chain a run reads them too. They are lifted with the caps (`IS_USAGE_CAPPED`), the rows written
  anyway. A read of the caps or the ceilings hands its operation `{ organizationId, userId }` alone
- Every route that starts or continues a run, the send, an answer, an approval, Resume, Retry and an
  upload, mounts `verifiedEmailMiddleware`, then `conversationsSuspensionMiddleware`, after
  `organizationMemberMiddleware`; the stops, the reconciles and the reads mount neither. The
  development backend asks for no confirmed address (`IS_EMAIL_VERIFICATION_REQUIRED`, held by
  `EMAIL_VERIFICATION_REQUIRED=true`). A suspension is read where a worker claims a run
  (`isClaimable`), never after, which would throw a paid turn away, and by a launch and a reaction:
  a new way to start a run that no member's route starts reads it too. Only `bun run
  suspend:conversations` writes it, locking the account's or organization's row and every membership
  it reaches, then stopping their runs. A start that must not commit for a suspended member reads it
  after the membership's lock, as `StartSubagentReaction` does
- A turn `pause_turn` paused is held in memory until it ends, then stored as consecutive `ASSISTANT`
  entries, one write each, the first with the context message: a crash between two leaves it paused
  at its last part, which the next worker continues. A reply past 20000 characters is drawn in
  pieces, its entry's cursor keeping its piece (`drawnPieces`)
- The thread, `ConversationMessage`, is a drawing of the transcript and what the page reads, ordered
  by `position`, never time: a mutation inserting messages claims positions on the conversation's
  `nextMessagePosition` under `@check(this == 1)`, and a loser reads it again. The counter only
  grows
- The page reads the thread in three parts: `GetConversation`'s live tail of the latest 150
  messages, with only what is small or changes in place; each body once by id
  (`GetConversationMessageBodies`); and older pages (`GetConversationMessagesBefore`), merged by
  `createConversationThread`, which reads its pages again when `historyRevision` moves. A field that
  changes in place belongs in the tail, one that never changes in the bodies. A file's bytes come
  from `GET …/attachments/:attachmentId` alone, with the reader's token past the HTTP cache
  (`useConversationAttachmentFile`), drawn from an address `useObjectUrl` holds, and an image drawn
  small from a small copy (`useImageThumbnail`)
- A web conversation mutation takes the caller's own `$userId`, checking `vars.userId == auth.uid` on
  its first, redacted step, and the live queries' refresh conditions match
  `mutation.variables.userId == request.auth.uid`, since the backend's Admin SDK mutations carry no
  `mutation.auth.uid`
- A run is `QUEUED`, `RUNNING` or, a subagent's, `PENDING` exactly while its conversation's
  `activeRunId` names it. Every write that ends a run lets go of it in the same mutation, matching
  `activeRunId` and never filtering on `deletedAt`, or a conversation restored later stays busy. A
  lease is set on the database's clock (`leaseExpiresAt_time`): two minutes queued
  (`CONVERSATION_RUN_QUEUED_LEASE_MS`), then a minute that every write of its worker renews. A
  claimed run past it is dead, finalized as interrupted by the next route that counts or starts, or
  by the page's reconcile. A queued run past it is checked against Cloud Tasks
  (`finalizeDeadConversationRun`): pushed back while its task is there, queued again while under
  twenty minutes old, finalized after. A run whose task could not be queued has its lease brought
  in to now, so its page reconciles it at once. Development has no queue, so a queued run past its
  lease is dead there
- Every write of a worker is fenced: its first step is the run's own update, matching `RUNNING`, its
  claimed attempt and its author's membership by the `createdAt` the run recorded, so a worker whose
  run was claimed again, or whose author left, writes nothing more. It is the run's only write in the
  mutation, since a second write to the row would be skipped, so the run's end, step and lease ride
  in its data, as `RenewConversationRunLease`'s do. A `Timestamp` read back keeps its
  microseconds and matches itself in a filter, which `check:conversation-runs` checks
- A message the backend draws takes an id derived from what it is drawn from
  (`deriveConversationMessageId`), so a worker taking over draws the same ids from the entry's cursor
  (`drawnBlocks`), and drawing twice conflicts rather than copies. Drawing finds an entry by its id
  and cursor, never by the run that stored it, so a resumed run draws what the run it carries on left
  undrawn. The member's message keeps the browser's id, so a retried send stores it once, and names
  the run it started, so a Retry deletes that run's messages but it
- A stop sets `stopRequestedAt`, read before each request and every two seconds while one streams
  (`createConversationRequestSignal`); a turn already answered is still stored, and a queued run is
  stopped at once. Resume deletes the stopped or interrupted note, the thread's newest message,
  moves no `historyRevision`, and refuses once anything follows it. Retry cuts the transcript after
  the run's anchor, deletes the messages of every run on it and moves `historyRevision`. A route
  receiving either again answers with the run numbered after the one it names. Every run that ends
  with a note says why in its `failure`, and `FinishConversationRunWithNote` pairs each status with
  its note
- Conversations are searched by the backend alone, `POST …/conversations/search`, since a search
  finds messages, which no web query could group by conversation. `Conversation.title` and
  `ConversationMessage.text` are `@searchable(language: "simple")`, read with `queryFormat: PLAIN`,
  ordered by relevance alone. A query in Chinese or Japanese matches by substring
  (`isSubstringSearchQuery`), over every title and the messages of the 20000 most recently active
  conversations.
  Only member and agent messages are searched
- A subagent is a conversation with a `parent`, launched with a brief (`launchSubagent` in
  `domain/subagents/`), run as its member's and hidden from them: every read or count of a member's
  conversations filters `parentId: { isNull: true }`, and every way a member acts on one refuses a
  subagent, in the domain and in the mutation, while a read of one conversation by id reads one as
  any other. A new read, count or action does the same. Its run sends `SUBAGENT_SYSTEM_PROMPT` and
  `buildSubagentTools`, both pinned, asks and tags nothing, and ends only through
  `FinishSubagentRun`, `FinishSubagentRunWithNote`, `InterruptSubagentRun` or
  `InterruptDeadSubagentRun`, which write its `report` as it ends. `check:subagent-runs` checks the
  operations
- A parent's page draws its subagents from `GetConversationSubagents`, live, once `subagentCount`
  says it launched one. A subagent's runs write under its own id, so the list refreshes on them by
  member and organization, and on the parent's own writes by the parent's id: a new write that
  changes a subagent's row, or its latest run's status, names itself there. A subagent's thread is
  drawn read only (`ConversationSubagentDialog`), its brief's files read among the parent's
  (`GetConversationBriefAttachments`). No page polls a subagent's run, so the parent's page
  reconciles them (`useReconcileConversationSubagents`)
- A subagent's run at one of its limits before its fourth run (`MAX_SUBAGENT_RUNS`) chains:
  `ChainSubagentRun` ends it `CHAINED` and queues the next, `CONTINUE`, in one write, its id derived
  (`deriveChainedRunId`), and the next is queued once the lease has stopped; a run asked to stop as
  it reaches a limit stops instead. The fourth run asks for
  the report (`SUBAGENT_REPORT_REQUEST`) once a budget nears its end (`isSubagentReportDue`), and that
  last request may go on to 12 minutes after the claim (`readSubagentReportDeadline`), nothing its
  reply calls running. Only the last run writes the report
- A member has five subagent runs at once in an organization
  (`MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER`), apart from their own three: a launch first finalizes
  their dead subagent runs, then takes a free slot (`LaunchSubagent`) or waits `PENDING`
  (`LaunchPendingSubagent`). A promotion sets the run's `createdAt` again, so its twenty minutes to
  be queued again count from there. A promotion (`PromoteSubagentRun`, looped by
  `promoteSubagentRuns`) runs after every end that freed a slot, never inside it, skipping runs
  asked to stop, deleted or under a replaced membership, which `GetSubagentPendingRuns` leaves out
  in the query, never in code. A new way to end a subagent's run that held a slot promotes after it.
  The parent's reconcile route and the sweep reconcile a member's subagent runs
  (`reconcileSubagentRuns`)
- A parent reacts to its subagents' reports in a run triggered `REPORTS` (`reactToSubagentReports`),
  once every live subagent its runs launched on one anchor has reported and the parent is idle.
  `StartSubagentReaction` marks exactly the reports its entry carries delivered, so two subagents
  ending at once start one reaction, and the thread draws its report blocks as nothing. A report
  names the first 20 module writes and integration calls with their totals, a call that may have run
  marked unanswered (`isToolUnanswered`), since no restore undoes another company's server. A
  subagent's end starts its parent's reaction, and any other end of a member's run their oldest due
  (`startDueSubagentReactions`), its own conversation's first: a new way to end one does too. A
  reaction launches and deletes nothing (`isReactionCaller`)
- A send carries every finished report not delivered yet, after the turn's results, and so do an
  answer's continuation and an Allow's run. Each names what it marks delivered,
  `$deliveredSubagentIds`, always passed, empty when nothing waits. Resume and Retry carry none. A
  parent ended full marks its reports delivered (`FinishConversationRunFull`,
  `MarkSubagentReportsDelivered`)
- Every write on a parent and its subagents locks, in order, the membership, the parent's runs, the
  parent's row, its subagents' runs and their rows, each reading its lock's response.
  `check:conversation-runs` reads that order off the mutations: a new write on a parent keeps it.
  Stops, deletes and Retry cascade to the anchor's live subagents, freeing their slots at once
  (`stopConversationSubagents`) and promoting after
- `bun run check:conversation-races`, in the backend's package, races the runs' bounds and cascades
  against a real Postgres in Docker, with four emulators on it behind a proxy, since one emulator
  runs one operation at a time on any database (`withPostgresEmulators.ts`), on ports beside the
  person's stack. It never runs in CI: run it before a release that changes a run's mutations. `bun
  run emulators:postgres` serves the same stack until Ctrl-C
- A domain function hands an operation only the variables it declares: Data Connect refuses one it
  does not, which the fakes let through, so pass a member as `{ organizationId, userId }`

### The backend

- Claude reads a conversation's files through Anthropic's Files API (`ClaudeFiles`), uploaded once.
  Development and production share its workspace, so every file is named
  `CLAUDE_FILE_NAME_PREFIX` and its attachment's id, and only production's sweep deletes those no row
  names. The count endpoint takes no Files API source, so a file is counted once from its bytes into
  `tokenCount`, and every measurement takes file blocks out and adds those counts
  (`replaceConversationFiles`)
- Conversations' routes are `routes/conversations.ts`, at
  `/organizations/:organizationId/conversations` with `mergeParams`, behind
  `organizationMemberMiddleware`. A send queues a run and `enqueueRun` sends it on: in development
  in the backend's own process, in production (`ARE_CONVERSATION_RUNS_IN_PROCESS` off) as a Cloud
  Tasks task, `run-<runId>` on `conversation-runs`, delivered to the worker's
  `/internal/conversation-runs`, whose request stays open for the whole run, since Cloud Run throttles
  the CPU once a response is sent. Queueing twice queues once (`ALREADY_EXISTS`), and a run that could
  not be queued stays queued while the send answers 503
- A subagent's run goes through a queue of its own, `subagent-runs` (`SUBAGENT_RUN_QUEUE_PATH`), so a
  fan-out never holds members' replies. A task's name exists only under its queue, so a run's queue
  (`ConversationRunQueue`) is a required argument of everything that touches its task
- A conversation search is metered twice: in the instance's memory
  (`createConversationSearchRateLimitMiddleware`), and across instances by `RecordConversationSearch`,
  120 in ten minutes per member, under the membership's lock. The query travels in the body, never
  the address, and is never logged
- A worker's writes go through its run's lease (`createConversationRunLease`), one after the other,
  and its steps are read afresh (`runConversation`), so taking over follows the same path as carrying
  on
- What a run asks Claude lives in `domain/agent/`, through a `ClaudeClient`: the real one, the
  placeholder, and the tests' scripted one, which records each request's bytes and refuses to count
  a Files API source, as the endpoint does. Every request is
  built by `buildConversationRequest`, in one key order, so it starts with the last one's bytes, and
  passes `checkTranscript`. The system prompt and the tools are pinned by their hash: a change costs
  every conversation its earlier reasoning once, so it ships with a release that means to. Load the
  `claude-api` skill before writing code that calls Claude
- Each tool is run by a `ConversationToolRunner`, the modules' from the connection a claimed run
  opens (`connectConversationModules`): its name, whether it only reads, and a `run` that checks its
  input and answers JSON or throws a sentence Claude can act on. A write the worker stops waiting
  for is answered as one that may have run. What becomes of each call is planned from the transcript
  alone (`planConversationToolCalls`), so a worker taking over plans the same, and each result waits
  in `pendingToolResults` until its entry is stored. `ask_user` is answered by the member, and what
  waits is the conversation's (`isAwaitingAnswer`)
- Integrations reach the agent through three tools always in `CONVERSATION_TOOLS`:
  `list_integrations`, `describe_integration_tool`, and `call_integration_tool`, not strict, its
  input checked by `checkConversationIntegrationCall`. Their runners
  (`createConversationIntegrationRunners`) close over the run's fence, and a call goes through
  `callIntegrationTool`, 30 seconds in all, as the member, a 401 alone marking their connection
- A call to an integration is decided once, when it is drawn (`decideConversationIntegrationCall`):
  refused, run at once when an administrator lets its tool run without approval, or an `APPROVAL`
  the member allows or denies. A subagent's that would wait is drawn failed, asking it to propose
  the call in its report. The last two bind the server's `configRevision`, the tool's definition
  hash and the credential's generation, which Allow and the call itself check again, the run
  carrying a subagent on included: a mismatch denies the approval, its result saying the server
  changed. An approval waits as a question does (`kind in [QUESTION, APPROVAL]`), the turn's other
  calls running beside it, as David chose. A call that started is never made again: one cut off is
  finished as interrupted
- A continuation carrying an allowed call stores no entry: `ContinueConversationRunWithCalls` starts
  its run with its results, and the worker makes the calls, then stores the turn's results and
  anchors the run on them (`StoreConversationToolResults`' `$anchorPosition`), so a Retry keeps the
  call. A send denies the approvals waiting and answers an allowed call never run, each by a list it
  names
- The conversation domain's tests run against `createConversationDatabaseFake`, the backend
  connector's conversation operations over tables in memory, holding the modules' fake as `modules`
  and the integrations' as `integrations`; a test bringing its own runners passes
  `connectTestModules(runners)`. `bun run check:conversation-runs` and `check:conversation-search`
  check the same conditions against the emulators: an operation changed is changed in both

### The page

- The dock's windows are each member's in each organization, kept by `_ConversationDockProvider`
  under one persisted key, by `${userId}:${organizationId}`, since the key a persisted state reads
  is read once. A minimized window reads only
  `GetDockConversations`, which refreshes on every mutation that changes a conversation's title,
  `activeRunId`, `unreadCount`, `isAwaitingAnswer` or existence: a new one joins its refreshes
- A composer's message, mentions, files, send state and last run are kept per account, organization
  and conversation for the tab's life (`~data/conversationComposerDrafts`), shared by every view
  drawing it, so anything new a message holds goes there, never in a view's state. An upload is the
  tab's (`~data/conversationAttachmentUploads`, three at a time), an answer under way too
  (`~data/conversationQuestionAnswers`), and anything else a reader has under way joins them on
  `createTabStore`
- A thread scrolls the window on its page and a box of its own in a dock window, `scrollerRef`:
  scroll or measure it through `readConversationViewport` and `scrollConversationToEnd`, never
  `window`

A subagent has no page of its own: its address opens its parent's page with its work over it,
`?subagent=<hyphenated id>` (`ConversationSubagentBouncer`), before anything of the page draws. View
work pushes that search as a step of the history, with `isFromConversationThread` in its state, so
Back closes the viewer.

## Module conventions

A module is one of Strategy Dance's capabilities served as an MCP server, which Strategy Dance's
agent uses in its own process and a member can add to an agent of their own: Knowledge and Tasks,
then Subagents, which Strategy Dance's agents alone reach. `MODULES` in strategydance-core lists
each one's name, path, title and scopes, and `SERVED_MODULE_NAMES` those served to external agents.
[conversations.md](documents/conversations.md) § Modules says what each does and why.

- A module's server lives in `src/modules/<name>/`, built by its `create<Name>Server(caller)`, one
  file per tool, which validates, calls `domain/<name>/` and shapes the result. `src/modules/` holds
  `MODULE_SERVERS` and `createModuleHandler`, the SDK's `createMcpHandler` around a fresh server for
  each request, statelessly, which Strategy Dance's agent and the public endpoint both go through.
  What the tools share, `readModuleWriteCall`, `createModuleAddresses`, `moduleSchemas`, and in
  `domain/modules/` the call results and `isOperationRefusal`, gains what a module needs rather than
  being copied
- A module is worded for members in the web's `module` catalogue (`getModuleMessages`, typed over
  every `ModuleName`), so a module added to `MODULES` fails the typecheck until it is worded there.
  `MODULES`' `title` is the server's own, in English
- The caller, `ModuleCaller`, is verified before a server is built and reaches it in the SDK's
  `AuthInfo` `extra` (`toModuleAuthInfo`, `readModuleCaller`), never from a tool's arguments. Every
  operation matches the membership on the caller's `membershipCreatedAt`, so a member removed, or
  removed and invited back, stops every agent acting as them. Its `launcher`, `{ conversationId,
  runId }`, is filled only by a worker that claimed a run, and every Subagents tool refuses a caller
  without one. `readModuleCaller`'s schema is strict: a field the caller gains joins it
- A tool's name is snake_case, as Claude takes it (`^[a-zA-Z0-9_-]{1,128}$`, no dot, though MCP
  allows one), and unique across the modules and the agent's own tools, which share one list:
  `moduleServers.test.ts` fails on a clash between modules. The order a module registers its tools
  in is frozen, since the agent lists them so
- A tool takes a zod input schema and an `outputSchema`, answers `structuredContent` with the same
  JSON as text (`toToolResult`), carries annotations (`readOnlyHint` on reads, `destructiveHint` on
  a delete or a write that can rewrite what it changes whole, `openWorldHint: false` on all), and
  refuses with a result, `isError` and a sentence the model can act on (`toToolRefusal`), never a
  protocol error. Claude's list keeps only a tool's name, description and input schema, so
  annotations move no pinned bytes
- Every write takes an idempotency key in the call's `_meta`, under
  `com.strategydance/idempotencyKey`, and its mutation inserts its `ModuleCallResult` first, under
  `@include(if: $isKeyed)`: a key taken refuses the write, and the module answers the stored result
  to the same tool with the same arguments, hashed as canonical JSON, refusing anything else. The
  scope is the caller's, `conversation:<id>` or `connection:<id>`. A write checks the caller's write
  scope before reading anything
- Strategy Dance's agent reaches `CONVERSATION_MODULES` in process: a claimed run connects to each
  (`connectConversationModules`) as its member, every scope, through the module's handler, by the
  SDK's client pinned to the 2026-07-28 revision. A module's tools join after the agent's own, not
  strict (`toConversationModuleTool`), each schema as the module wrote it less its dialect, and the
  module's own schema checks every call. That schema still has to be one the API takes: run `bun run
  probe:claude` whenever a module's tools change. A subagent's worker sends none of the Subagents
  module's tools nor the deletes (`isSubagentTool`), and its requests carry their own settings,
  `SUBAGENT_REQUEST_SETTINGS`
- The agent keys each write with Claude's id for the call, so a worker taking over, or a Resume
  calling again, is answered from its key, and finalizing a dead run, or a send answering its calls,
  settles each write it left started from its key (`settleConversationModuleWrites`): a stored result
  is the call's, recorded through `SettleConversationToolCall`, which refuses while a run holds the
  conversation, and anything else is answered as a call that may have run
- What a module reads and writes goes through backend operations named `…ForAgent`, which take
  `$userId` and `$membershipCreatedAt` and hold to the AI permissions for every caller: a document
  whose `isAiReadable` is off is never loaded, one whose `isAiWritable` is off never changed. Tasks
  carry no AI permission. Each write names itself in the refreshes of the live queries whose rows it
  changes, web queries included
- The tests drive a module through the SDK's `Client`, pinned to 2026-07-28, on a transport handing
  each request to the module's handler with the caller as `authInfo` (`createModuleTestKit`), never
  the SDK's in-memory transport, which speaks only 2025. They run against
  `createModuleDatabaseFake`, to which each module's fake adds its own, since a handler loads every
  module's server and Bun refuses an import the mock does not hold: a new module's fake joins it.
  The Subagents module's tools import `domain/subagents/` inside their handler (`await import`), so
  no other module loads the conversation runtime, and its tests run against
  `createConversationDatabaseFake`; a module whose domain needs the runtime does the same. `bun run
  check:knowledge-module`, `check:tasks-module` and `check:subagents-module`, in the backend's
  package, check the operations against the emulators: an operation changed is changed in both
- An external agent reaches a module at `https://api.strategydance.com/mcp/<name>`, each module its
  own OAuth resource, once a member allowed it on the consent page. Its caller comes from the access
  token, read by `createAgentConnectionTokenVerifier` at every call: `kind: 'external'`, the token's
  scopes, `connection:<id>`, the membership's `createdAt`. A verified token marks its connection used
  at most once a minute (`createAgentConnectionUseRecorder`, `RecordAgentConnectionUse`)
- A served module's write tools each register `scopeChallenge: requireModuleWriteScope(module)`, so
  a connection granted read alone still lists them, and a call answers 403 `insufficient_scope`, as
  MCP's step-up asks. An external agent's search draws on the member's search allowance
  (`recordModuleSearch`), which their conversation searches share, and one past it is answered with
  `toTooManySearchesSentence`
- A module joins the external agents with its name in `SERVED_MODULE_NAMES`, which mounts its
  endpoint and its metadata and lets the authorization server and the consent page take it; one
  served to nobody, as Subagents is, is refused as an address no module has. It also takes
  `requireModuleWriteScope` on every write, its searches on the allowance, the agents button on its
  page (`ModuleAgentsButton`) and its endpoint in `check:oauth`
- `bun run mcp:knowledge <email>` and `mcp:tasks` serve a module over stdio against the emulators,
  through `serveModule.ts`, whose logger writes to stderr, stdout being the protocol's. The local
  backend serves them over HTTP too, as its own issuer: `claude mcp add --transport http
  strategydance-knowledge-http-local http://localhost:3003/mcp/knowledge`, the same for tasks, then
  `/mcp` in Claude Code to sign in
- Run once by hand, after the release that added each, in the backend's package: `bun run
  backfill:document-text --production`, `backfill:task-text --production` and
  `backfill:task-done-at --production`
- `bun run suspend:conversations --production <email | organization id or slug> [--lift]`, in the
  backend's package, is staff's suspension of an account's or an organization's conversations, and
  `bun run report:usage --production [--days <n>] [--workspace-usage <dollars>]` what conversations
  cost, by organization and account, against each ceiling, read through the Admin SDK's GraphQL.
  `finalizeDeadConversationRun` logs `DEAD_RUN_LOG_PREFIX` for each run it ends, which a log-based
  metric counts and an alert watches (Setup 13 in conversations.md): its words change with the
  metric's filter

## Email conventions

`packages/strategydance-emails` holds the transactional emails as React Email templates, and only
renders them: each `renderXEmail` takes props and answers `{ senderName, subject, html, text }`. The
delivery provider and its key stay on the backend's side.

- Everything comes from the one `react-email` package, components and `render` alike: version 6
  deprecated `@react-email/components` and the per-component packages
- `src/emails/` holds templates and nothing else, since the preview server takes every file there
  for one. Shared pieces go in `src/components/`. A template sets the `PreviewProps` the preview
  renders it with
- Styles are inline style objects alone: Gmail and Outlook strip `<style>` blocks and know no CSS
  variable, so the design system's tokens are copied into `src/constants.ts` as literals. The one
  `<style>` block is `EmailLayout`'s font face, which a client may drop at no cost. react-email's
  `Font` is not used, since it sets every element's family to the face
- Images, the mark included, are hotlinked PNGs at an absolute production URL, from
  `packages/strategydance-web/public/assets/images/`: Gmail and Outlook render neither inline SVG
  nor a `data:` URI. A new image shows broken, in the preview too, until a release has deployed it
- The backend's `tsc` follows its import into these `.tsx` files, so both tsconfigs carry `"jsx":
  "react-jsx"` and agree on their other options: keep them agreeing
- English only for now, with no em dashes, as the catalogues' rule says
- `bun run dev:emails` opens the preview through `scripts/devEmails.sh`, which runs the CLI from a
  scratch directory outside the tree: read its header before changing how it is invoked. The preview
  is indicative, so check a real client before trusting a layout change

## Tackling a task

"Tackle task 123", or anything worded like it, names a task of the team's own board in Strategy
Dance: read it through the `strategydance-tasks` MCP server, the production Tasks module at
`https://api.strategydance.com/mcp/tasks` acting as the person, never the `-local` ones, which serve
the emulators. Then do what it asks as any other task, [Workflow](#workflow) included.

- What follows "task" is whatever the person copied: the task's id, which `read_task` takes
  hyphenated or not, or a piece of its name, which `list_tasks` finds with `query`. A piece that
  matches several tasks is a question for the person, never a pick. Several tasks named at once are
  each tackled the same way
- Its description, which `read_task` answers in Markdown, is the brief. A `task:<id>` link in it is
  another task, which `read_task` opens, and a `doc:<id>` link a knowledge document, which the
  Knowledge module's `read_document` opens where the session has it. A task it waits on that is not
  done yet blocks it, which is worth saying before the work starts
- When the session has no `strategydance-tasks` tools, or they ask to sign in, say so and stop
  rather than guess the task: the person adds the server with `claude mcp add --transport http
  strategydance-tasks https://api.strategydance.com/mcp/tasks` and signs in with `/mcp`
- Once the work starts, `update_task` moves the task to `ONGOING`, from whatever column it is in,
  before the first edit, so the team sees it taken up
- Once its pull request merges, which `bun run review open` reporting `MERGED` or the person says,
  `update_task` moves it to `DONE`, and the person is told of the tasks its answer says can start now
  (`canStartNow`). Nothing else on the board changes unless the person asks, since the server writes
  as them

## Workflow

**This section is the person's own request, standing in every session.** Any task that changes a
tracked file, however small, goes branch → granular commits → push → pull request into `dev` →
CodeRabbit review loop → handed to a human, in one go, without stopping to ask. "Should I commit?",
"Want me to open a pull request?" and "Shall I address the review?" all have the answer yes, and
a turn that ends on one of them has failed: the person then has to come back and say what this
section already says. Work is finished when its pull request is green, reviewed and waiting for
a human, not when the code is written.

It does not apply to a task that changes nothing tracked, such as a question, an investigation
or a review. It gives way when the person says otherwise for the task at hand ("don't commit",
"just try it", "only look"). And three things stay a human's call whatever the task: merging a
pull request, the release to `main` (both below), and the `deploy:*` scripts (see Commands).

A turn ends in one of two ways only: the pull request is handed over (the last step below), or
the work is blocked on something only the person can supply, such as a credential, a product
decision a review raised, or a check that fails for a reason outside the change. Anything else
is a reason to keep going.

This section reads the same in sunshine and strategydance, apart from each repository's
commands, and `scripts/codeRabbitReview.sh` and `scripts/ship.sh` are the same file in both. An
improvement to one goes to the other.

### Where to work

One session at a time works in the main checkout, on a branch of its own: the **primary**. The
person's dev servers serve that checkout, so its edits show on the stack they already run as
each one lands, and it needs no server of its own. Every other session works in a worktree and
never edits, switches branches or commits in the main checkout: what is there is the primary's
work in progress, and a `git switch` changes the ground under the primary and the person's
servers alike. Only a handover, below, moves it from one session to another.

Which one you are is settled **before the first edit**. When the main checkout is on `dev` and
clean, nobody holds it, so you become the primary: check and branch in one command, then tell
the other sessions, as a handover's last step does.

```sh
git fetch origin dev
test "$(git branch --show-current)" = dev && test -z "$(git status --porcelain)" && git switch --no-track -c <branch> origin/dev
```

Read `git branch --show-current` again before the first edit, and before every commit there.
Two sessions that check at the same moment can both switch, and the later switch takes the
checkout from the earlier: when it prints another branch, work in a worktree instead. When it
prints `dev`, the switch did not stick, and a commit would land on `dev`.

On any other branch, or with anything uncommitted, the main checkout is somebody else's, a
session's or the person's. Create a worktree instead, and do every edit, test, commit and push
in it:

```sh
git fetch origin dev
git worktree add --no-track -b <branch> .claude/worktrees/<branch> origin/dev
cd .claude/worktrees/<branch>
bun install --frozen-lockfile  # its postinstall generates the Data Connect SDK
ln -s <main checkout>/packages/strategydance-translations/.env packages/strategydance-translations/.env  # if the main checkout has one
```

- Branch from a freshly fetched `origin/dev`, not from local `dev`, which is only as recent as
  the last pull in the main checkout, and the main checkout may not even have `dev` checked out.
  `--no-track` keeps the branch from tracking `origin/dev`: the first `git push -u origin HEAD`
  gives it its own upstream
- Claude Code's `EnterWorktree` creates its worktree from `origin/main`, the repository's
  default branch, which lags `dev`. Create the worktree with the commands above and pass its
  `path` to `EnterWorktree`
- The translations `.env` is gitignored, so a new worktree has none, and `bun run translate`
  needs its key. A link rather than a copy, so a rotated key reaches every worktree
- When what should ship is uncommitted work already sitting in the main checkout, copy it across
  rather than committing it there: `git -C <main checkout> diff HEAD --binary | git apply` from
  the worktree, plus any untracked files by hand. Leave the original for the person to discard.
  `--binary` is what carries an edited image: a plain diff only says it differs
- The person's stack usually holds ports 5173 and 3003 from the main checkout, and other
  sessions run worktree servers of their own. To look at the worktree's frontend, start it on
  the first port from 5174 that nothing listens on (`lsof -nP -iTCP:<port> -sTCP:LISTEN` prints
  nothing): `bunx vite --port <port> --strictPort` from its `packages/strategydance-web`. The
  development backend accepts any origin. Aim a browser or a script at that port and no other,
  since one left on a port another session took tests that session's branch without a word
- Keep the worktree until the pull request merges, since the review rounds are fixed in it, then
  `git worktree remove .claude/worktrees/<branch>`

**Handing the main checkout over.** At the end of the review loop, a session in a worktree asks
the person whether they want its branch checked out to see the work (see
[Hand the pull request to a human](#hand-the-pull-request-to-a-human)), and a request of theirs
to check a branch out ("check it out", "put it on my checkout") is the same yes. Only their word
hands the main checkout over, never a session's own convenience. On a yes:

1. **Ask for it**, unless it is on `dev` and clean. `ListAgents` names this repository's other
   sessions after it (`strategydance-…`): send each one message saying that you are taking the
   main checkout for `<your branch>`, that the session working on `<its branch>` there moves to
   a worktree and says when it is free, and that any other answers it is not theirs. Wait for
   the answers, since silence is not consent: a session in another permission mode holds the
   message for its person. When no session claims the branch, the person put it there, or a
   session that has since ended did: go on if the checkout is clean, telling the person which
   branch it was on, and when it is not, say what is there and stop
2. **The primary moves to a worktree** when asked, and takes its uncommitted work along rather
   than committing it half done:

   ```sh
   git switch --detach  # in the main checkout: lets go of the branch, keeps the uncommitted work
   git worktree add .claude/worktrees/<branch> <branch>
   cd .claude/worktrees/<branch>
   git -C <main checkout> diff HEAD --binary | git apply  # plus any untracked files, by hand
   bun install --frozen-lockfile
   ln -s <main checkout>/packages/strategydance-translations/.env packages/strategydance-translations/.env  # if the main checkout has one
   ```

   Once `git status --short` lists the same paths in the worktree as in the main checkout,
   untracked files included, it takes that work out of the main checkout
   (`git -C <main checkout> restore --staged --worktree .`, then deletes the untracked files it
   carried), answers that the main checkout is free, and carries on in the worktree.
   Only its own work comes out: when something else is there too, it leaves the checkout as it
   is and tells the asking session and the person. Never stash, since the stash stack is shared
   by every worktree and session
3. **The new primary moves in.** Its worktree lets go of the branch first, since git checks a
   branch out in one place at a time, and anything uncommitted there comes across before the
   worktree goes:

   ```sh
   git switch --detach  # in the worktree
   cd <main checkout>
   git switch <branch>
   git -C .claude/worktrees/<branch> diff HEAD --binary | git apply  # plus any untracked files, by hand
   git worktree remove .claude/worktrees/<branch>  # with --force if it held uncommitted work, once `git status --short` lists the same paths here as there
   ```

   Every further edit, commit and review round happens in the main checkout
4. **Tell every other session** of the repository that you are the primary now, and on which
   branch

Around every switch in the main checkout, the first one off `dev` included:

- The switch moves the code, not what is built from it. Run `bun install --frozen-lockfile`
  there when it changed dependencies or the database package, whose SDK its postinstall
  regenerates: an install that is not frozen can rewrite `bun.lock`, which leaves the checkout
  dirty
- The Data Connect emulator watches the main checkout's `schema.gql` and connectors, and
  migrates the moment they change on disk, dropping every table it cannot migrate additively.
  Before a switch or a restore that changes the database package, check whether it runs
  (`lsof -nP -iTCP:9399 -sTCP:LISTEN`). When it does, say so and let the person stop it, or
  export its data first (`bunx firebase emulators:export ./firebase-export-<date>-backup`)
- Never use `--ignore-other-worktrees`: with one branch checked out twice, a commit in either
  leaves the other's files behind, and the stale one then shows that commit reversed as staged
  changes
- A session inside `EnterWorktree` leaves it first (`ExitWorktree`, keeping the worktree): its
  isolation guard refuses every command aimed at the main checkout

**When the primary's pull request merges**, which `bun run review open` reports as `MERGED`, the
primary fetches `origin/dev` (`git fetch origin dev`). When its branch then holds nothing more
(`git log origin/dev..HEAD` lists nothing) and the checkout is clean, it puts the main checkout
back on `dev`: `git switch dev && git merge --ff-only origin/dev`. That frees it for the next
session to start, so it tells the other sessions, and it answers a request for the checkout the
same way rather than moving to a worktree.

`dev` is the integration branch: every pull request starts from it and goes back into it. The
one exception is the release that takes `dev` to `main`, which is a human's call (see below).
Never commit to `dev` or `main` directly, and never leave a branch with commits but no pull
request.

### Commit as you go

One logical change per commit, each self-contained and passing `bun run lint && bun run
typecheck && bun run test && bun run build` on its own. A dependency bump, a refactor and a
feature are three commits, not one.

Commit each piece as soon as it passes, without asking and without waiting for the rest of the
task. When a message changed, `bun run translate` runs before those checks (see
Internationalization), and the locale files and the lock go in the commit with the message.

Stage by path (`git add <path>…`), never `git add -A` or `git add .`, and read `git status
--short` before each commit. The Firebase CLI and its emulators write untracked files into the
tree at unpredictable moments, and an unexpected path belongs in `.gitignore`, not in a commit.

Write subjects in the imperative mood, saying what the change does rather than which files it
touches. A husky `commit-msg` hook (`scripts/prefixCommit.ts`) prepends a scope derived from the
staged paths: `[web]`, `[backend]`, `[core]`, `[directories]`, `[external-mcp-servers]`, `[database]`, `[design-system]`,
`[translations]`, `[emails]`, `[documents]`, or `[root]` when the change spans more than one. **Write the message
without a prefix and let the hook add it**; a prefix you write by hand is respected, so a wrong
one sticks. A commit touching two packages is always `[root]`, which is a reason to keep commits
within one package where it is natural.

### Open the pull request

As soon as the code part is committed, push and open the pull request, in the same turn:

```sh
git push -u origin HEAD
gh pr create --base dev --title '<what the change does>' --body-file - << 'EOF'
<what changed and why, and how it was verified>
EOF
```

`--base dev` is not optional: the repository's default branch is `main`, and a pull request into
`main` deploys to production the moment it merges.

Never open a pull request as a draft. CodeRabbit skips drafts, so the wait in the loop below
would come back with no review.

GitHub deletes a branch once its pull request merges. `git fetch --prune` drops the
remote-tracking ref it leaves behind.

The person merges when they choose, sometimes while a session is still working on the branch.
Before every push to a pull request's branch, and before editing its description, check that it
is still open with `bun run review open <number>`, chained in front: `bun run review open
<number> && git push`. It fails and names the state unless the pull request is open, where `gh
pr view` succeeds whatever the state and would let the push through. A push after the merge
re-creates the branch GitHub deleted, with no pull request to carry it: when it says `MERGED`,
open a new pull request from the same branch for what `git log origin/dev..HEAD` lists. When it
says `CLOSED`, somebody closed it on purpose, so stop and ask the person rather than pushing,
reopening it or opening another.

### CodeRabbit review loop

CodeRabbit reviews every pull request into `dev` when it opens and at each push, as
`.coderabbit.yaml` asks, and writes how far it has got into the head commit's `CodeRabbit` status.

1. **Wait for the review of the head you pushed.** `bun run review` (`scripts/codeRabbitReview.sh`)
   holds every GitHub call of this loop: it has to be a script, because a session inside a
   worktree refuses a `gh` call nested in `$(…)` or in a shell loop, which a wait is.

   ```sh
   bun run review wait <number>   # returns once CodeRabbit has reviewed the head this checkout pushed
   ```

   The round is the head commit's, so the wait needs no baseline and never returns an earlier
   round. When CodeRabbit's status says it waits to be asked, as the free plan of a public
   repository under ten stars can, the wait asks it with an `@coderabbitai review` comment, and
   does the same once a rate limit runs out. Reviews are rationed by the hour, ten on that free
   plan, shared by every session, so never ask by hand: an ask beside the wait's costs a review. A
   round with nothing to say ends `Review completed` and leaves no review at all.
   **Wait in the foreground, inside the same turn**. Nothing else is waiting on you, and a turn
   that ends on "I will pick it up when it lands" leaves the person to come back and tell you it
   has. A review takes a few minutes. The wait gives up after nine minutes, inside the shell's
   ten-minute cap, with exit status 75 and a message: run the same command again, as many times
   as it takes.
2. Wait for CI (`gh pr checks <number> --watch`) and fix whatever fails. Its job, `ci` in
   `.github/workflows/check-pull-request.yml`, is a required check on `main`.
3. Answer every CodeRabbit comment, either with an edit that addresses it or a reply explaining
   why it does not apply. Never ignore one, and never resolve one without replying first. Each
   carries a *Prompt for AI Agents*, which restates the finding and is no more right than it: check
   it against the code first.

   Reply on the thread, then resolve it, so the next round shows only what is still open. `gh`
   has no command for either, so the script does both over GraphQL, keyed by the thread id:

   ```sh
   bun run review threads <number>   # open threads: id, path, line and first comment, one JSON object each
   bun run review reply <thread id> - << 'EOF'
   <reply>
   EOF
   bun run review resolve <thread id>
   ```

   Reply first, resolve second: resolving hides the thread, and a reviewer who cannot see the
   answer reads it as the comment having been waved away.

   Read the review's body too (`bun run review body <number>`), not only its threads. CodeRabbit
   lists findings there that have no thread to reply on: *Outside diff range comments*, against
   lines the round's diff did not touch, *Duplicate comments*, which it still holds from an earlier
   round, and *Nitpick comments*. Handle the first two the same way and answer them in one pull
   request comment (`gh pr comment <number>`). Fix a nitpick that is right; one left alone needs no
   answer.

   All of this happens **before the push**, so the next review reads the replies along with the
   diff rather than re-raising what has already been answered. CodeRabbit may answer a reply in
   its thread once it is resolved; what it still holds, it raises again in the next round. Citing a
   commit that exists only locally is fine: it will be pushed before anybody follows it.
4. Commit the fixes, granularly, without pushing yet.
5. Push behind the open check (above), which is what starts the next round. Do not push while a
   review is in flight: land the round you have, answer it, then push its fixes as one batch.
   Pushing mid-round spends a review on a head you are about to replace, and draws findings against
   code that is gone.
6. Repeat from step 1 until a round comes back with nothing but nitpicks or praise. Step 1, not
   step 2: CI can finish before the new review exists, and answering the threads at that point
   answers the old round again.

### Hand the pull request to a human

Never merge a pull request, nor set one to merge itself: that is a human decision, taken on
GitHub after a human approval.
Once CI is green and review is clean, say so and link the pull request. Unless you are the
primary already, ask in the same message whether the person wants the branch checked out on the
main checkout to see the work: a yes is a handover (see [Where to work](#where-to-work)). Then
stop there.

Humans merge with a merge commit, not a squash, and the repository allows nothing else: the
granular commits are the point, and squashing collapses them into one.

### Ship `dev` to `main`

Taking `dev` to `main` is a release, and a human's call like any other merge, since it deploys
everything, the database included (see below). `bun run ship` (`scripts/ship.sh`) opens the
release pull request, titled "Ship dev to main", with the release's commits as its body, and sets
it to merge itself, with a merge commit, once `ci` passes. `main`'s ruleset asks for no approval,
so running it is the release, and only a human runs it. It is idempotent, reporting the open one
rather than failing and setting it to merge if it is not already, since a release pull request
stays open across merges into `dev` for as long as a check fails, and it refuses to run while
local `dev` has unpushed commits the release would leave behind. Auto merge stays set as `dev`
moves on, so whatever lands on `dev` before `ci` passes goes out with the release, a fix for a
check that failed included. To hold an open release back, turn its auto merge off
(`gh pr merge <number> --disable-auto`): the next `bun run ship` turns it on again. Nothing
pushes to `main` directly: its ruleset accepts only a pull request.

### What a merge into `main` deploys

Every push to `main` runs `.github/workflows/deploy-merge.yml`, which deploys the release in the
order it needs: Data Connect, the backend and the worker, the Storage rules, then the frontend.
Each step waits on the one before it, so a release that stops partway stops before anything that
relies on what failed.

It runs as `deployer@strategydance.iam.gserviceaccount.com`, which has no key, since the
organization forbids creating one: GitHub's OIDC token is traded for it through Workload
Identity Federation, and only a run on `main` in this repository may. The workflow's header
lists what it is granted, which includes rewriting the production database, so pushing to
`main` is as good as holding it.

It never passes `--force`. A migration that only adds runs by itself. One that drops anything,
a renamed table included, stops the release before the backend and the frontend move, and so do
a connector change Data Connect calls breaking and a new insecure operation. Read the SQL the
log printed, run `bun run deploy:database` by hand if it is what the release means, then re-run
the deploy of `main`'s tip. A re-run keeps the commit its run started on, so a run `main` has
moved past refuses to deploy rather than put an older release over a newer one.

A pull request gets a Hosting preview only when somebody runs `firebase-hosting-pull-request.yml`
by hand from the Actions tab with its number, since a preview takes a production build and one of
the channels Hosting caps a site at. It holds the one key the repository holds, which its header
explains. `delete-preview-channel.yml` deletes a pull request's channel when it closes, since a
preview past the cap fails with a 429. Run by hand from the Actions tab, it deletes every channel
but `live`, which is the way out once the quota is full. Both triggers run the copy on `main`,
whatever a pull request's base: `pull_request_target` always runs the default branch's workflow,
and GitHub offers a workflow to run by hand only once the default branch holds it, the preview's
included. A change to either takes effect with the release, not with its merge into `dev`.
