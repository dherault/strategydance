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
    hand it to micromark (M37). A shape found slow later joins the count, measured the same way
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
- [oxlint](https://oxc.rs) lints and oxfmt formats. See [Linting and formatting](#linting-and-formatting)
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
| `bun run grant:administrator <email>` | Makes an account that has signed in once an administrator of Strategy Dance, in the emulators only |
| `bun run send:conversation <email> [--conversation <id>] [--file <path>]… [--organization <id or slug>] <text>` | Sends a message to a conversation, a new one unless one is named, through `dev:backend`, as that account, uploading each file first, and prints the conversation's address |
| `bun run measure:subagents [--configurations <name,…>] [--briefs <name,…>] [--max-total <dollars>] [--max-subagent <dollars>]` | Prices short briefs run as subagents on each model and effort weighed, from a throwaway account of the emulators, a dollar a subagent and fifteen in all at most, and prints the table `SUBAGENT_REQUEST_SETTINGS` is chosen from. `--briefs long` runs one made to run long instead: `--configurations opus-medium --max-subagent 3 --max-total 3`. It costs money unless run under `CONVERSATION_AGENT=placeholder` |
| `bun run launch:subagent <email> --conversation <id> [--count <n>] [--file <attachment id>]… <brief>` | Launches up to 10 subagents of that account's conversation, as the Subagents module does, in its own process, and prints each transcript and report. A promotion runs in the process that freed the slot, so launch an account's subagents from one script at a time. Emulators only, and it costs money unless run under `CONVERSATION_AGENT=placeholder` |
| `bun run mcp:knowledge <email> [--organization <id or slug>]` / `mcp:tasks` | Serves the Knowledge or the Tasks module over stdio as that account of the emulators, with every scope, for an MCP client on this machine: `claude mcp add strategydance-knowledge-local -- bun run mcp:knowledge <email>`. See [Module conventions](#module-conventions) |
| `bun run check:directories [--count <n>] [--inactive <n>] [--name <name>]… [--dry-run] [--publish]` | Runs the directories' daily check into this checkout's two files, or with `--publish` into the rolling pull request on GitHub. About $0.10 a directory. See [directories.md](documents/directories.md) |
| `bun run probe:claude` | Sends Claude's API the conversations agent's request and checks what only the real model can confirm. It costs money: run it after an Anthropic SDK bump, a change of model, price or top output rate, or of a module's tools, never in CI. Its key is the `anthropic-api-key` secret, or `ANTHROPIC_API_KEY` when set |
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
| `bun run deploy:backend` | Builds the root `Dockerfile` on Cloud Run and deploys `strategydance-backend`, then the same image as `strategydance-worker`. Every push to `main` runs it too |
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
ends.

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
  preview creates a real account. Look at what renders there, never exercise sign-up. Its App Check
  debug token, printed on first run, has to be registered in the console first
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

Schema and operations live in `packages/strategydance-database`, and the generated SDK is the
only way the app talks to them.

- One connector per caller. `strategydance-web-connector` is the browser's, and
  `strategydance-backend-connector` the backend's, beside it rather than widening it, because
  `@auth` levels differ by who is asking and the web bundle should not carry operations only a
  server may call
- The backend connector is generated as an Admin SDK, and every one of its operations is
  `NO_ACCESS`, which only the Admin SDK gets past. The backend verifies the caller's ID token
  and passes the uid it verified as a variable, never one a client sent, and each operation
  still checks that uid against the rows it touches
- The generated SDKs cannot pass a `_Data` list variable, so no connector can batch insert:
  the backend calls a single-row mutation once per row instead
- A level of a `where` holds plain fields or `_and`, `_or` and `_not`, never both: Data Connect
  refuses the mix, so the plain fields go in an `_and` entry of their own, as
  `SearchConversationsBySubstring` puts them
- An operation takes no `@check` of its own. A check that reads only variables sits on a field
  of the first, redacted step, where `@check` is repeatable
- A mutation runs as one SQL statement, each step a part of it, unless a step reads an earlier
  step's `response`: then every step runs as a statement of its own, in order. Every part of one
  Postgres statement reads the snapshot it started with, so a step after a lock never sees what the
  writer holding the lock committed while it waited, and only a condition in an update's `where` is
  checked again, on the row as it stands. A step that counts, or writes rows it finds by a filter,
  after a lock another writer takes reads the lock's response, as the starts' membership reads
  `response.userOrganization_update.userId`, or a query step's after it, as
  `AnswerConversationQuestion`'s count of the questions left reads the waiting run's conversation
  (M41). The mutations outside conversations still count in one statement, which a later pull
  request takes on
- A step that runs as a statement of its own sees what its own mutation wrote before it, and one
  statement does not: either way, count around the rows the mutation writes, by their ids, as
  `AnswerConversationQuestion` leaves out the question it answers
- A mutation takes one `query` step: a second is refused ("selecting `query` again is not yet
  supported"). A check that has to follow a write, once its row is locked, goes in that one step,
  after the write, with the membership's and the variables' checks beside it, as
  `FoldDocumentForAgent` does: a refusal there rolls back the writes before it all the same
- A `@check` on a field under a list a step reads is never invoked when the list is empty, and Data
  Connect then refuses with that check's message rather than the list's own. A variable's check
  nested under the membership a write reads takes `optional: true`, as the Tasks module's writes'
  do, so a removed member is refused with the membership's message, which the module matches
- A step runs or not on a variable through `@include(if: $flag)`, as a module's write inserts its
  `ModuleCallResult` only when its call carries a key. The step's variables are still required,
  so a call that skips it sends them empty, and a key it names is refused null even when it is
  skipped: a step whose key a call may lack is an operation of its own, as `RecordOAuthClientUse` is
- A foreign key a later step violates is reported before an earlier step's `@check`, as
  `ApproveOAuthAuthorizationRequest`'s insert refuses a caller who is not the member before its
  lock's check can: the backend reads both messages as one refusal (`isMembershipRefusal`), as it
  reads a token's reference to a connection gone meanwhile as a revoked grant
  (`isConnectionGoneRefusal`)
- A mutation writes each row once. In one statement Data Connect runs the first write to a row and
  silently skips any later one, aliased or not: an `organization_update` row lock followed by
  another `organization_update`, or by `organization_delete`, changes nothing, while steps that run
  apart apply both. When the row a mutation locks is the row it writes, the write itself is the
  lock, and the checks follow it
- Every operation carries an `@auth` level. `USER` keys off `auth.uid`, so a query cannot be
  shaped to read somebody else's row. The one `PUBLIC` operation is the sign-in screen's email
  lookup, and its comment says what that costs. The other exception is the authorization server's:
  its backend operations find a registered client, an authorization request, a code or a token by
  its id or its hash before any `$userId` is verified, since whoever holds a random UUID or a
  256-bit token is whom the OAuth flow trusts, and only hashes are stored. So does the callback of
  members' Connects to an organization's MCP servers, which finds a Connect by its state's hash
  (`GetIntegrationAuthorizationByState`) and keeps the code it brought back, which only the member's
  own signed-in page finishes
- A table references the account and the organization apart, so removing a member, which deletes
  the membership and nothing else, keeps what they wrote. A connection is the exception, the
  membership's, and goes with it, its tokens with it: `AgentConnection`, an external agent acting as
  the member, `IntegrationConnection`, the member's own account at one of the organization's MCP
  servers, and `IntegrationAuthorization`, a Connect of theirs under way. Data
  Connect cannot reference a key made of references, so `UserOrganization` names its columns,
  `userId` and `organizationId`, and the reference names them with `@ref`, its constraint named
  short of Postgres' 63 bytes
- A member reads and disconnects their own connections through the web connector:
  `GetAgentConnections`, live, and `DeleteAgentConnection`, keyed by `auth.uid`. The list is
  refreshed by Allow (`ApproveOAuthAuthorizationRequest`) and Disconnect on the caller's `$userId`,
  by `RemoveOrganizationMember` on the member removed, and by `DeleteOrganization` for every reader,
  never by the `lastUsedAt` write. An operation added later that makes or deletes a connection, a
  membership's included, names itself there. Allow holds a member to `MAX_AGENT_CONNECTIONS`, counted
  under a lock on the member's own row, which their consents in every organization take in turn,
  and the list reads that many, so it is never cut short and Disconnect reaches every agent acting
  as them. The emulator's PGlite runs one transaction at a time, so no race shows there: a lock's
  reasoning is Postgres', and `check:oauth` guards the outcome. That count reads its one
  statement's snapshot, which misses a consent committed while it waited on the lock, until the
  pull request after M41 has it read the lock's response
- An operation that finds its row by `auth.token.email` rather than `auth.uid`, as the
  invitation ones do, is `USER_EMAIL_VERIFIED`. A password sign-up can name any address nobody
  has claimed yet, so the address proves nothing until it is verified. The claim lives in the ID
  token, so a tab that just saw the address confirmed mints a new one, as `refetch` on
  `AuthenticationContext` does. Locally the Auth emulator prints the confirmation link in its
  log rather than sending it
- Server values over variables wherever the server knows better: `id_expr: "auth.uid"`,
  `email_expr: "auth.token.email"`, `updatedAt_expr: "request.time"`. A client that fills these
  in can write a row as somebody else
- `Organization.slug` leads its pages' paths. The browser draws it at creation, from the name
  and four random characters (strategydance-core's `createOrganizationSlug`), the column's unique
  index refuses one another organization holds, and it never changes, so a link to an
  organization outlives a rename. One a page from before slugs created has none, and is addressed
  by its id. The UUID stays the key everywhere else: the database, the backend's routes and
  Storage's paths
- An operation gains a variable without a breaking connector change by making it optional, which
  a page from before the release leaves out. A `@check` on it reads `!has(vars.state) ||
  vars.state == null || …`: `vars.state == null` alone errors on an absent variable, and refuses
  every call from that older page
- A filter on an optional list variable left out is dropped, so `id: { in: $ids }` without `$ids`
  matches every row the rest of the filter does. A write filtered so counts its rows against the
  list, as the sends' `$attachmentIds` step checks `this == size(vars.attachmentIds)`, and this
  without it, so a caller from before the variable is refused rather than writing rows it never
  named. `check:conversation-attachments` checks it
- A nullable variable left out of a write leaves its column as it was, and only null clears it: a
  write meant to clear a column, as `ReconfigureOrganizationIntegration` clears the key given for
  another server, is called with every such variable, null included, which
  `createIntegrationDatabaseFake` holds the backend to
- An organization's MCP servers are `OrganizationIntegration` rows, which the backend alone writes.
  An edit carries the name, `configRevision` and `keyGeneration` its dialog showed, and an approval
  the revision its tools were shown under, which the row has to hold still when the request arrives
  and when it is written, so an administrator's change made meanwhile wins over a stale view.
  Approvals are added and removed by hash (`autoApprovedTools_update`), never rewritten, so one given
  meanwhile stays.
  `GetOrganizationIntegrations`, live, never selects the key's ciphertext nor the tools, which
  `GetOrganizationIntegrationTools` reads for one dialog: a write added later that changes what
  either selects names itself in their refreshes, and the agent's `lastUsedAt` write (M29) never
  does. `bun run check:integrations`, in the backend's package, checks the operations against the
  emulators
- A member's own account at an OAuth server is an `IntegrationConnection`, one per member and
  server, and a Connect of theirs under way an `IntegrationAuthorization`, both the backend's alone to
  write. Tokens, codes and PKCE verifiers are encrypted, each bound to its purpose, the server and the
  member (`buildIntegrationSecretContext`), and no web operation selects one: the page reads its own
  connections through `GetIntegrationConnections`, live, which no refresh of the tokens wakes. A
  connection's `generation` is a UUID made at every connect and kept by a refresh, so no disconnect,
  reconfiguration or removal ever repeats one, which M29's approvals bind to. A refresh claims a lease
  on the connection, `refreshingUntil` from the database's clock, only while the connection holds the
  refresh token its caller read, so a rotating refresh token is spent once, and writes and lets go by
  the lease's id alone. A member's write on the server's row, a Connect's start or its connection,
  locks the row at the revision and issuer it started under; `ReconfigureOrganizationIntegration` and
  `ChangeOrganizationIntegrationIssuer` write the row first and delete the connections and Connects
  after, so under read committed none outlives them, an order a change to either keeps
- The ids a route hands an operation are canonical (`toCanonicalUuid`), whatever spelling its path
  used: a live query's refresh condition compares the variables as text, and a page that names ids
  hyphenated, as the page a sign-in ends on does, would otherwise refresh no other tab
- `Locale` is declared in both `schema.gql` and strategydance-core, because neither side can
  read the other. `packages/strategydance-database/schema.test.ts` is what fails when they
  stop agreeing. Add a locale to both
- Every other enum, `CompanyAspect` among them, lives in `schema.gql` alone. The generated SDK
  exports each as values in the schema's order, and the frontend imports them from
  `strategydance-database/web`
- The generator declares an enum only when some operation of the connector selects a field of
  that type at its top level. One selected only under a nested relation is named in the types and
  never declared, which `tsc` does not catch past `skipLibCheck`: `GetConversationMessagesBefore`
  reads its messages at the top level for that reason
- That order is the Postgres enum's, and reordering an enum's values is a breaking migration.
  Append a value; never reorder. The order the aspects are shown in is `COMPANY_ASPECTS` in the
  web package's `constants.ts`, and `constants.test.ts` fails when it stops matching the enum
- A schema change reaches production with its release: a push to `main` migrates the database
  and deploys Data Connect before the backend and the frontend that query it. A migration that
  drops anything stops the release for a human instead, as
  [What a merge into `main` deploys](#what-a-merge-into-main-deploys) says

A list a page keeps current, like a team, is a live query. `@refresh(onMutationExecuted: ...)`
on the query names each mutation that changes it, with a condition on the variable they share,
so every mutation such a query listens to takes that variable, even one that could do without
it. A mutation the backend runs through the Admin SDK fires the refresh too. The frontend
subscribes beside its first read and writes each pushed result into the TanStack cache:
`useOrganizationTeam` is the example to copy.

Read a query that takes variables through `useQuery` and `executeQuery` rather than the
generated hook. The generated wrapper keeps its query ref in state and updates it in an effect,
so on the render where the variables change it reads the old ones' data into the new key.

A query that a waiter and the page under it both read sets `retryOnMount: false`, and tells a
failed read apart from an empty one (`hasFailed` on `useOrganizationTeam`). With nothing cached,
a retry resets the query to pending: the waiter unmounts the page, the page mounts again once
the read fails, and its mount retries it, forever.

A knowledge document's text is live in another way: it is a Yjs document, so several members
write it at once and their edits merge as they type. `Document.state` holds it as a snapshot in
base64, the source of truth for the text, and each `DocumentUpdate` row an edit pushed since;
`content` is a copy of the text each compaction writes, for what reads it without an editor. The
page's sync, `createKnowledgeDocumentSync`, pushes the reader's edits as updates, merges those
`GetLiveDocument` pushes, and folds the pending ones into the snapshot through
`CompactDocumentWithText`, guarded by `revision`, and a tab that sees `revision` move reads the
snapshot again through `GetDocument`. `GetLiveDocument` leaves the snapshot out, so a keystroke
pushes a few small rows rather than the whole text to every tab. `DocumentPresence` rows, one per
open tab, say where each caret is, and `GetDocumentPresences` keeps them live for the carets and the
faces.

- Every write of `content` writes its plain text beside it, `contentText`, which the Knowledge
  module's search reads through the full-text index on it and `title`: the page through
  `CreateDocumentWithText` and `CompactDocumentWithText`, which take it as required, and the
  backend's folds and creates. `CreateDocument`, `CompactDocument` and `UpdateDocumentContent`
  stay for pages from before, and write null instead, which means not indexed yet, never stale: the
  search indexes such a document from its `content` before it reads the index, under the revision
  it read. A new way to write `content` writes `contentText` too, or nulls it
- Anything that writes a document's text, an agent included, writes it through Yjs. Once a
  document has a snapshot, a write to `content` alone is refused, and the next compaction would
  write over it anyway. The backend reads and writes it through `domain/knowledge/` alone, on the
  rows a caller read: the snapshot with every pending update merged, as top-level blocks with
  their ids and Markdown, and an edit folded into it, which says the `state`, `content` and
  `contentText` to store and the updates to delete
- Outside an editor, the text is written as a difference, through the design system's
  `updateRichTextYDoc`, never as a document rebuilt from blocks, which shares no history with the
  stored one and merges as a second copy. It keeps the nodes y-prosemirror's read produced, with
  the read's metadata: blocks matched by equality alone can pair an untouched block with a new one
  and delete it, with whatever somebody typed in it
- An agent's edit of the text keeps the text it replaced as a `DocumentRevision`, in the mutation
  that stores the edit, `FoldDocumentWithRevisionForAgent`, so the two commit together or not at
  all, under the edit's key: its snapshot compressed with gzip, its `content` for a member to look
  at, where the agent acted from (the module call's scope) and the call's key, and a fingerprint of
  the text the edit left (`fingerprintKnowledgeDocumentText`). A new `…ForAgent` write of a
  document's text keeps one the same way.
  `FoldDocumentForAgent` stays only for the backend from before the release, which deploys after
  Data Connect. Members alone read revisions, whatever the team lets agents do with the document,
  and go back to one through the backend (`routes/knowledge.ts`), which writes its text back as a
  difference, `updateRichTextYDoc`'s `restore`, keeping every block the two share, and keeps one of
  its own for the restore. An Undo goes back only while the text still has that fingerprint. It
  hashes every node, attribute and character y-prosemirror reads, ids included, never the agent's
  Markdown, which says nothing of a line break in a table's cell nor of a cell's alignment, so a
  member's change Markdown cannot say would otherwise be overwritten. They are kept 30 days
  (`DOCUMENT_REVISION_LIFETIME_DAYS`), which the daily sweep prunes
- Data Connect takes 4 MiB a request, gRPC's bound, which the emulator names when one passes it,
  and a write carrying a document's text twice, the new snapshot beside a revision, can pass it: a
  knowledge write is measured first (`isKnowledgeWriteTooLarge`) and refused rather than sent, never
  written without its revision
- The text reaches the editor without `parseRichText`, so the editor's schema is what keeps it to
  the blocks it knows, and a tab on an older bundle deletes a block its schema lacks from the shared
  text. A new block type reaches every tab before anybody can write one, and so does a new inline
  type, unless David chooses to ship it with the release that writes it, as mentions shipped. So
  does a new style: y-prosemirror throws on a mark its schema lacks, and then deletes the whole text
  of the block holding it. Inline code shipped with the release that writes it, by David's choice. A
  node's props are append-only: y-prosemirror writes every attribute, and a shared text holding
  one its schema does not declare can no longer be read by the backend. The Yjs helpers read with
  a schema too, `RICH_TEXT_EDITOR_BLOCKS` unless told another, and their read deletes a block it
  lacks as surely: a document's editor and its helpers keep to one list
- A mutation cut off midway, as a closing tab cuts it off, can leave the Data Connect emulator's
  database stuck in its transaction, refusing every mutation after until the emulator restarts.
  A document's page folds nothing as it goes away, as `CompactDocument` is a transaction, and the
  writes it does send then, `PushDocumentUpdate`, `UpdateDocumentPresence` and `LeaveDocument`,
  are not

What a conversation keeps, and how, is in [Conversation conventions](#conversation-conventions).

The build in public page counts a member's streak from `ActivityDay` rows: one per member,
organization and day on which they changed their own Today data, their top priority, their
checklist or their log, or any task on the team's board. The day is the one the change was made
on, never the day it was about, and `RecordActivity` holds it to the caller's today. The
mutations that make those changes do not write the row themselves, since each would need a
`$date` it has no other use for, a breaking connector change: the web app calls `recordActivity`
once one goes through, from the `change` helpers of `useChecklist` and `useTaskChanges` and from
the components that set a priority or write the log. A new way for a member to change Today data
or the board calls it too, or the days it is used on go uncounted. An agent's change to the board
never counts: no write of the Tasks module records an `ActivityDay`, for Strategy Dance's agent or a
member's own, so a streak counts what members do themselves.

The team's tasks are a board: `Task` rows in a column per `TaskStatus`, which any member of the
organization changes, as its knowledge. Each field is written by a mutation of its own, so two
members editing one task keep each other's changes, and a move writes the one task that moved,
halfway between its new neighbours. A move into Done from another column goes through `FinishTask`,
which stamps `doneAt` from the server's clock, since no write can stamp it only when its status
variable is DONE and a move within Done sends that status too: a new way to finish a task stamps it,
as the Tasks module's create and update do with `$doneAt`. Both moves name the column the page saw
the task in, `$fromStatus`, and a task that has left it is refused rather than moved back, which
keeps a teammate's move and never puts a task into Done unstamped. `TaskDependency` links a task to
those it waits on: the server refuses a task waiting on itself or on one waiting on it, and the page
offers no pick that would close a longer loop, nor an Undo that would bring one back. The board
keeps `GetTasks` live, without the descriptions, and reads them once for its search through
`GetTaskDescriptions`, again on focus; a task's dialog keeps its own live through
`GetTaskDescription`, and opens it for writing only once that read lands, since the search's copy
can be older than a teammate's save. A query that held every description live would push them all to
every open board at each save, and a drag would too. Removing a member takes them off the tasks they
were doing.

Every write of a task's description writes its plain text beside it, `descriptionText`, which the
Tasks module's `list_tasks` matches a query against, never the serialized blocks: the page through
`CreateTaskWithText` and `UpdateTaskDescriptionWithText`, which take it as required, and the module's
own writes. `CreateTask` and `UpdateTaskDescription` stay for pages from before, and write null
instead, which means not indexed yet, never stale: a query indexes such a task from its description
first, while its `updatedAt` is the one it read. A new way to write a description writes
`descriptionText` too, or nulls it. `RestoreTask` refuses a task deleted over a day ago, whether or
not a prune has run, so a day means a day wherever a restore starts.

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
  A branch that skips it ships six locales that silently render English
- **Never write an em dash in a `defaultMessage` or a `description`**: use a full stop, a comma or
  a colon. It reads as machine-written, and all six locales inherit it

## Backend conventions

`packages/strategydance-backend` follows sunshine's backend, trimmed: one router per resource
in `routes/`, the Express middleware in `middleware/`, what a route does in `domain/`, helpers
in `utils/`, one concern per file.

- Rich text, its Yjs helpers and its Markdown come from the design system's `lib/`, imported by
  their exported paths, `strategydance-design-system/lib/*`, never a component, and `yjs` at the
  design system's range, so one copy resolves: the helpers test their Yjs types with `instanceof`.
  The backend's `tsc` follows those modules into the editor's block specs, which build elements
  with `document` in functions only an editor on a page calls, so its `lib` takes DOM, and the
  emails' with it, so the two still agree
- Every answer is the `ApiResponse` envelope from strategydance-core, and every refusal goes
  through `respondError` with an `ERROR_CODE_*` from there, so the web app reads one shape. It
  calls the backend through `requestApi` in `~data/api`, which throws an `ApiError`, carrying the
  answer's `Retry-After` as `retryAfterMs`, which the backend's `cors` exposes. A file goes up
  through `uploadApiFile`, on `XMLHttpRequest`, since `fetch` tells nothing of a body on its way,
  and its bytes come back through `requestApiFile`: never an `<img>` pointed at the backend, which
  carries no token
- No body parser is applied app wide. A route parses its own, then runs `appCheckMiddleware`,
  `authenticationMiddleware` and `validateMiddleware`, and reads its caller with `readViewer`.
  A route taking a file parses last instead, after `organizationAdministratorMiddleware` or
  whatever says the caller may send it, so nobody else gets megabytes buffered. The worker's
  internal routes run neither App Check nor the token's check: Cloud Run's invoker check guards
  them, as the next bullets say
- The same image runs as two services, built by `createApp` in `src/app.ts`. The backend,
  `strategydance-backend`, mounts every route but the internal ones. The worker,
  `strategydance-worker`, started with `SERVICE=worker` (`IS_WORKER`), mounts `routes/internal.ts`
  at `/internal` and nothing else, so neither answers the other's routes. A route Cloud Tasks or
  Cloud Scheduler calls goes in `routes/internal.ts`, never beside the backend's
- The worker is private where the backend is public: its invoker check stays on, and
  `conversation-tasks@strategydance.iam.gserviceaccount.com`, the account Cloud Tasks and Cloud
  Scheduler call it as with an OIDC token, is the one account granted `roles/run.invoker` on it,
  on the service alone, never on the project. Anybody holding Cloud Run's invoke permission across
  the project can call it too, as they can any service there: its owners, and `deployer` through
  `roles/run.admin`. Cloud Run refuses everybody else before the code runs, a caller with no token
  included, so no internal route verifies a token by hand. On the public backend it would have to,
  and a run of up to fifteen minutes would share its instances and its timeout. The worker's
  timeout is fifteen minutes and its concurrency four; the backend keeps Cloud Run's defaults. Its
  address is Cloud Run's deterministic one, `WORKER_URL`, which is also the token's audience
- Credentials are Application Default Credentials: nothing is stored, and on Cloud Run the
  service's own account needs `roles/firebasedataconnect.dataAdmin`, which runs reads and writes
  but cannot change the schema, and `roles/storage.objectAdmin` on the bucket. For conversations'
  runs it also needs `roles/cloudtasks.enqueuer` and `roles/cloudtasks.viewer` (a queued run's
  task is looked up, which the enqueuer role cannot), and `roles/iam.serviceAccountUser` on
  `conversation-tasks`, which a task carrying that account's token takes. Both services run as
  it. In development `dev:backend` points Auth, Data Connect and Storage at the emulators, and
  App Check is skipped, as the emulators skip it
- The service is public, and `deploy` makes it so with `--no-invoker-iam-check`, never
  `--allow-unauthenticated`. The project sits in the strategydance.com organization, whose
  domain restricted sharing refuses the `allUsers` member that flag grants. Turning the invoker
  check off lets anybody call the service without widening its IAM policy; what guards a route
  is its own middleware, App Check and the caller's ID token
- The organization also withholds the Editor role Google used to hand default service
  accounts. `deploy` builds on Cloud Build as the Compute Engine default service account, which
  is also the account the service runs as, so it starts with no roles: grant it
  `roles/run.builder` before the first deploy, beside the Data Connect and Storage roles it needs
  to run and Secret Manager's accessor role on each secret it reads
- A push to `main` deploys the backend and the worker with the rest of the release, by running
  `bun run deploy:backend`, as [What a merge into `main` deploys](#what-a-merge-into-main-deploys)
  says. `.gcloudignore` leaves out `gha-creds-*.json`, the credentials file the job writes into
  the workspace, which the upload would otherwise carry into the image
- Organizations' logos and banners are the backend's to write, since only an administrator may
  and a Storage rule cannot read who administers what. It stores each under a fresh name with
  its own download token, writes that URL to the row, and deletes the file the row pointed at
  before. `storage.rules` grants clients nothing under `organizations/`
- A logo arrives as a form, with the thumbnail the page drew of it (`createImageThumbnail`, fitted
  inside `THUMBNAIL_SIZE`), and is stored beside it as `logoThumbnailUrl`. A profile picture's
  thumbnail is the page's to write, beside the picture in Storage, as `imageThumbnailUrl`. The
  organization switcher, the user menu and the task board's faces draw the thumbnail and fall back to
  the picture, which is all a picture from before thumbnails, or from Google, has. The team's query
  selects it for the board; the other small faces, a team member's on the team page, a Today
  identity's and a document's presences, still draw the picture, until they draw it too
- So are the pictures of documents' text, which any member may put in, under
  `organizations/<id>/rich-text/`. Nothing deletes one before its organization is: the text points
  at it by its URL alone, and an undo or another tab can bring a deleted picture back
- So are the revisions of documents' text, which any member reads and goes back to, through
  `routes/knowledge.ts`, mounted at `/organizations/:organizationId/knowledge`: which of a
  conversation's edits an Undo can still take back, read from each document's text as it stands,
  and a restore, written back as a difference. Both merge a whole document's text in the instance,
  so a member makes 60 in ten minutes at most (`knowledgeRevisionRateLimitMiddleware`)
- So are the files sent in conversations, which the backend serves itself (`GET
  …/attachments/:attachmentId`), checking the reader is still a member, so none has a download
  token. An upload streams its body into Storage under `pending/{organizationId}/{userId}/{id}`,
  create-only, through a check of its signature and its declared `Content-Length`; a send copies it
  to `organizations/{organizationId}/users/{userId}/conversations/{conversationId}/{id}`. Every id
  in an object's name is canonical (`toCanonicalUuid`), never the route's spelling, so a retry
  finds the same object. `conversationAttachmentStorage` is the one module that touches the bucket
  for them, and a test that mocks `~firebase` without `bucket` mocks it instead, with
  `createAttachmentStorageFake`
- An upload reads its file back from Storage one at a time in the instance, then collects the heap
  whole (`Bun.gc(true)`): Bun collects the buffers a read-back leaves late, and twenty files of 10
  MiB at once took a backend past Cloud Run's 512 MiB otherwise. `bun run
  load:conversation-attachments <email>`, in the backend's package, is the check, against a local
  backend: run it after changing what an upload reads, holds or sends
- A request to an address somebody else gave goes through the outbound guard in `utils/`, never
  `fetch`. `requestOutbound` makes one request: http or https on its own port, https alone where
  the caller says, a hostname that is no name of this server's own network, every address it
  resolves to public (`isGloballyRoutableAddress`), the connection pinned to the address checked,
  and a redirect answered rather than followed. `fetchOutbound`, for a link preview's page or a
  client ID metadata document, follows redirects through it, each checked again, within a deadline
  and a byte cap. `createGuardedFetch` is the `fetch` the MCP SDK's client takes to reach an
  organization's MCP server: https alone, every redirect handed to the SDK, which follows a
  same-origin one through it again and refuses another, so a key never leaves its server, each
  request's deadline merged with the operation's, and a streamed body cut at its cap. A refusal names
  the origin alone, never a path or a query that could hold a key. The server otherwise reaches its
  metadata server and its own network on anybody's say
- Every email goes out through `sendEmails` in `domain/email/`, over Resend's batch endpoint, from
  `david@strategydance.com`. That domain has to stay verified in Resend, and the mailbox has to
  receive, since the welcome email asks for a reply. The key is the `resend-api-key` secret, read
  from Secret Manager through `retrieveSecret` in `utils/`, which caches it for the life of the
  process: the service's account needs Secret Manager's accessor role on it, and a rotated key
  takes effect with the next revision. A secret read by version, as `oauth-token-secret` is, goes
  through `retrieveSecretVersion`, which says which version the latest was and keeps each apart
- Only production sends. Anywhere else `sendEmails` writes the HTML to the OS temp directory and
  logs its path, and `sendOrganizationInvitationEmails` also logs each invitation's link, which
  is how an invitation gets accepted locally
- An organization's MCP servers are its administrators' to change, through `routes/integrations.ts`,
  mounted at `/organizations/:organizationId/integrations`, each route running
  `organizationAdministratorMiddleware`, and those that reach a server
  `integrationRateLimitMiddleware`. What they do is in
  `domain/integrations/`: `reachIntegration` lists a server's tools through the MCP SDK's client,
  a 2025 handshake first, or discovers an OAuth server's issuer, which has to offer S256 and a way to
  register, a server's origin taken as its authorization server only when every metadata address
  answered 404. Whatever fails is an `IntegrationFailure` of one of the database's
  `IntegrationError` kinds, which a route answers with its own code
  (`INTEGRATION_FAILURE_ERROR_CODES`), and nothing is saved when a server cannot be reached. A key
  is encrypted with Cloud KMS in production (`INTEGRATION_KMS_KEY_NAME`, on which the runtime
  account holds `roles/cloudkms.cryptoKeyEncrypterDecrypter`) and under a fixed local key anywhere
  else, bound to its organization and server, and read back only to reach the server again. A log
  or a refusal names a server's origin alone, never what it answered. The routes' tests run against
  `createIntegrationDatabaseFake` with `reachIntegration` mocked, `bun run check:integrations`
  checks the operations against the emulators, and `bun run probe:integrations` reaches every
  server of strategydance-external-mcp-servers through the same code from this machine
- Any member connects their own account to an OAuth server through the same router's
  `…/:integrationId/connection` routes, `organizationMemberMiddleware` in place of the administrator's:
  start, finish, cancel and disconnect. Strategy Dance is the OAuth client there, every request to the
  server and its authorization server through `createIntegrationFetch`, the guarded fetch, and the MCP
  SDK's `registerClient`, `startAuthorization`, `exchangeAuthorization` and `refreshAuthorization`,
  never its `auth()`: the client presented is Strategy Dance's client ID metadata document,
  `GET /integrations/oauth/client`, where the authorization server reads such documents and the
  backend is https, else the dynamic registration recorded on its row, the first recorded when two
  members' first Connects register at once, the other left unused. The
  authorization server's callback, `GET /integrations/oauth/callback` on the public backend
  (`routes/integrationOAuth.ts`), finds the Connect by its state's hash, keeps the code encrypted for
  two minutes and always answers a 303 to the app's page, which finishes it as the signed-in member:
  the code is exchanged for the account that started the Connect alone, so a sign-in somebody else
  started and sent connects nothing (OAuth CSRF). A token is read through
  `readIntegrationAccessToken`, refreshed under the connection's lease, and goes to the address of the
  revision it was given for. The backend logs no code, state, token or anything a server answered,
  the development logger leaving the callback's query out; Cloud Run's own request log keeps the
  callback's address, code and state with it, unless the exclusion of setup step 12 in
  conversations.md is in place, the code being worthless without the verifier the Connect keeps
  encrypted. The flow's tests run the real SDK through the
  guard against `createIntegrationOAuthServerFake`, an MCP server and its authorization server in
  memory, with `createIntegrationFetch` mocked to reach it
- The worker's `POST /internal/sweep`, which Cloud Scheduler calls once a day, removes what is
  still deleted past its Undo window whether or not anybody comes back: today the conversations
  deleted over a day ago, claimed first, so a restore refuses them, then deleted in batches, each
  with what its agent's module calls kept under its scope, `conversation:<id>`
  (`DeleteConversationModuleCallResults`), since nothing references the conversation from them. It
  is a conversation's only prune: starting one leaves its author's to it, and `RestoreConversation`
  refuses one deleted over a day ago whether or not the sweep has run. Each goes with its files,
  in the Files API and Storage, and their rows, found by the conversation, its author and its
  organization; one whose files could not all go stays claimed for the next sweep. Then the files
  uploaded to conversations and never sent, a reservation ten minutes old or a file two days old,
  and in production the files the Files API holds that no row names, a day old
  (`pruneConversationAttachments`). Then the
  board's tasks deleted over a day ago, with their links (`PruneDeletedTasks`), every
  organization's documents and MCP servers deleted over a day ago, documents' revisions over 30
  days old (`DeleteExpiredDocumentRevisions`), the servers with their keys and
  members' connections (`PruneDeletedIntegrations`), members' Connects to them expired over an hour
  ago (`PruneIntegrationAuthorizations`), the conversation searches over a day old, which
  no count reads any more, what runs that last spent over a day ago may have cost
  (`pruneRunSpends`), the module call results past their expiry, and the authorization
  server's requests expired over a day ago, its tokens past their expiry and the registrations
  nobody uses (`domain/oauth/prune…`). Before all of them, it reconciles the runs no page
  reconciled, as the reconcile below does. Each step runs whatever the steps before it met
  (`runSweepSteps`), and the route answers 500 naming those that failed. A milestone that keeps
  something deleted, or counted, for a while adds its prune there, idempotent like the rest, so a
  sweep that failed is finished by the next
- The worker's `POST /internal/runs-reconcile`, which Cloud Scheduler calls every five minutes,
  reconciles the runs no page watches: every member's subagent runs past their lease or waiting for
  a slot (`sweepSubagentRuns`), the runs of members' conversations past their lease
  (`sweepDeadConversationRuns`), and the reactions to subagents' reports no run's end started
  (`sweepSubagentReactions`), each step on its own (`runSweepSteps`), each going on past what fails
  in it and throwing once done when anything did (`SweepIncomplete`), so the route answers 500. A
  queued run whose task never came is queued again while it is young, and a slot freed is promoted
  into within minutes. A new kind of run no page watches is reconciled there too
- The worker's `POST /internal/directories-check`, which Cloud Scheduler calls once a day, checks
  a day's directories and commits what it found to one rolling pull request into `dev`, from the
  branch `directories-check`, which only it writes (`publishDirectoryCheck` in
  `domain/directories/`): it reads the lists at that branch's head, or `dev`'s when no pull request
  is open, and commits both files at once against the head it read. It reaches GitHub as a GitHub
  App, its id and private key the `github-app-id` and `github-app-private-key` secrets, minted into
  an installation token by `domain/github/`, since a pull request opened with Actions' own token
  runs no CI. It runs the last release's code on `dev`'s lists, so `readDirectoryLists` refuses a
  field or a value it does not know rather than write the lists back without it. What a run picks,
  proves and writes, and its setup, are [directories.md](documents/directories.md)'s
- Strategy Dance's OAuth authorization server, which external agents go through to reach a module
  as a member, is the public backend's: the protocol's own endpoints in `routes/oauth.ts`
  (`register`, `authorize`, `token`, `revoke`), the consent page's in `routes/oauthRequests.ts`,
  the metadata in `routes/wellKnown.ts`, and what they do in `domain/oauth/`. The protocol's
  endpoints answer OAuth's own JSON (`respondOAuthError`), a page or a redirect, never
  `ApiResponse`, carry no App Check, which no client could, answer any origin without credentials
  (`OAUTH_PROTOCOL_PATHS`, which the app's `cors` reads, matched exactly), never log a body, and
  find tokens by their hash. Each is metered per address, registration and authorization capped in
  all too, the token and revocation endpoints generously, since a hosted client calls them for
  every member from a few addresses of its own. The consent page's routes keep the app's middleware,
  App Check and the ID token, and are the only place a client ID metadata document is fetched,
  once a member has signed in. `createAgentConnectionTokenVerifier` is what a module's endpoint
  checks a bearer token with. Its tests run against `createOAuthDatabaseFake`, which the modules'
  fake composes, and `bun run check:oauth`, in the backend's package, goes through the whole flow
  against the local backend at `API_URL`, both modules' endpoints included, and checks the
  operations against the emulators: an operation changed is changed in both
- The modules' endpoints, `routes/modules.ts` mounted at `/mcp` (`MODULES_PATH`) on the public
  backend alone, serve each module strategydance-core's `SERVED_MODULES` lists at its `MODULES` path, `POST` alone,
  through the SDK's `toNodeHandler` around the module's handler. They answer MCP's JSON-RPC, never
  `ApiResponse` (`respondJsonRpcError` for what they refuse before the handler), and carry no App
  Check, which no external agent can carry: the bearer token is the guard. In order: any other
  method 405; an `Origin` other than the app's 403 (the SDK's `originValidation`, against DNS
  rebinding), one without passing; `moduleAddressRateLimitMiddleware`, per address, counting
  refused calls alone, so made-up tokens cost a bounded number of reads; `requireBearerAuth` with
  the token verifier and the endpoint's address as `expectedResource`, a 401 naming the module's
  protected resource metadata; `moduleRateLimitMiddleware`, per connection; then the body, 1 MiB at
  most, parsed only once the token is verified and handed to the handler whole, `(request,
  response) => nodeHandler(request, response, request.body)`, since the parser consumed the stream.
  They answer the app's origins
  alone, no browser client being served yet. Each served module's protected resource metadata (RFC
  9728) is `routes/moduleMetadata.ts`, the SDK's `mcpAuthMetadataRouter` mounted at the app's root,
  since its path ends with the module's, never under `/mcp`, and answers any origin, its path in
  `OAUTH_PROTOCOL_PATHS`. A client of a 2025 revision is served statelessly, over SSE, as the SDK's
  fallback answers it

## Conversation conventions

A conversation is a member's exchange with Strategy Dance's agent in one of their organizations,
every member of every organization having them: its runs, which the worker takes, the subagents
its agent launches, and the modules and integrations it calls.
[conversations.md](documents/conversations.md) says what each part does and why, and
[conversations-milestones.md](documents/conversations-milestones.md) how each was built.

### A run

```text
member's action ─▶ route ─▶ run QUEUED, activeRunId set, task queued ─▶ 202
worker: claim (RUNNING, lease) ─▶ loop: request Claude ▸ store the turn ▸ draw it ▸ run its calls ─▶ end
end: COMPLETED │ WAITING │ STOPPED │ FAILED │ REFUSED │ INTERRUPTED, activeRunId let go
later: WAITING ─▶ CONTINUED, once an answer or a send consumes its turn
```

- A run is triggered by a member's `MESSAGE`, `ANSWER`, `RESUME` or `RETRY`, a subagent's by its
  launch, `LAUNCH`, or the chain carrying it on, `CONTINUE`, and a parent's reaction to its
  subagents' reports by `REPORTS`. `PENDING` and `CHAINED` are a subagent's alone (see The data)
- One run goes at a time in a conversation. The first send inserts the conversation with its
  `activeRunId` set, and every later start takes the row with a `conversation_updateMany` matching
  `activeRunId: { isNull: true }` under `@check(this == 1)`, refused with
  `ERROR_CODE_CONVERSATION_BUSY`. A member has three runs in flight in an organization
  (`MAX_ACTIVE_RUNS_PER_MEMBER`), counted under their membership's lock once their dead runs are
  finalized, so a crash elsewhere never locks them out
- The worker claims a run `QUEUED`, or `RUNNING` past its lease, in a conditional update that adds
  one to `attempts`, the attempt each of its writes after is fenced on, and answers Cloud Tasks 200
  once the run is finished, or was already, and 503 while another worker holds its lease, so the
  task comes back after the queue's backoff
- A run's limits are the backend's: 25 requests (`CONVERSATION_RUN_MAX_REQUESTS`) and 10 minutes
  from its first claim (`CONVERSATION_RUN_MAX_DURATION_MS`), a stream still going 14 minutes after
  the claim cut (`CONVERSATION_RUN_STREAM_DEADLINE_MS`), inside the task's 15, 60 seconds a call
  (`CONVERSATION_TOOL_CALL_TIMEOUT_MS`), its $10, and the daily spend ceilings its member's runs
  share (below). A conversation holds 2000 entries
  (`MAX_CONVERSATION_MESSAGES`) and a run draws 100 (`MAX_CONVERSATION_RUN_ENTRIES`). Each is
  checked before a request, never after one, so a turn paid for is always stored and drawn, and a
  run at a limit ends `FAILED` with its note, the full note for a conversation at its 2000 or a
  context past what Claude takes
- The loop is the worker's own, never the SDK's tool runner, since a run stops for an answer and
  writes each step as it happens: read the stop flag, build the request and check it, stream it,
  writing its progress lines to `run.step` at most once a second, store the turn and draw it, then
  by `stop_reason`:
  - `end_turn`: `COMPLETED`
  - `tool_use`: run the calls (see A new tool), store one `USER` entry with every result in the
    turn's order, and go round again. A turn holding `ask_user` runs its other calls, keeps their
    results in `pendingToolResults`, and ends `WAITING`
  - `pause_turn`: send the turn back as it is, five times at most, its parts held in memory until
    it ends
  - `max_tokens`: run nothing, `FAILED` with its note
  - `refusal`: the request's server-side fallback runs it again on another model, and a refusal
    that survives it ends `REFUSED`
- A request Claude's API refuses before its stream starts, as rate limited, overloaded, failing or
  unreachable, costs nothing and is sent again, after its `retry-after` or a delay doubled at each
  refusal, four times in a row at most within the run's time (`MAX_CONVERSATION_API_RETRIES`). Any
  other error of the API fails the run with its note, and an error of the worker's own before the
  request reached the API settles it at nothing before the step fails
- Every write that ends a run cancels the calls still `RUNNING` in its conversation, not only those
  its run drew, and lets go of `activeRunId` where it still names the run, in the write that sets
  `isAwaitingAnswer` when it ends `WAITING`

### The transcript

- `checkTranscript` (`domain/agent/`) checks every request before it is sent, and a route the entry
  it adds, against the rules every flow keeps, since Claude refuses a history that breaks them:
  1. the first entry is the member's, `USER`
  2. a `SYSTEM` entry sits right after a `USER` one and right before an `ASSISTANT` one, never beside
     another, and last only as a request's context message, before it is stored
  3. an `ASSISTANT` entry with `tool_use` blocks is followed by a `USER` entry opening with one
     `tool_result` per call, in their order, before any text, image or document
  4. so only the last entry holds calls with no result

  A `server_tool_use`, web search's or the code around it, carries its result within its turn and is
  none of their business
- A run's context message is built when the run starts, kept on the run, and sent last, unstored,
  until the run's first turn lands, then stored with it, `SYSTEM` then `ASSISTANT` at consecutive
  positions, in one mutation. A turn that never lands stores neither. Its profile part, the member,
  the organization and the conversation's aspects, goes only when its hash differs from the
  `contextHash` of the last context message still in the transcript, so a Retry that cut one sends
  it again
- The `USER` entry that answers a turn, a send's, an answer's continuation's or the worker's, comes
  from `buildConversationToolResults`: a result for each call in the turn's order, a call kept from
  running answered `STOPPED_CALL_RESULT`, one that started and has none `INTERRUPTED_CALL_RESULT`,
  unless its module write's key holds one, and a question still waiting `SKIPPED_QUESTION_RESULT`
  (`conversationToolResults.ts`), then the subagents' reports waiting, then the member's file
  names, files and text
- A turn a fallback model finished is stored without the thinking, redacted thinking, `tool_use`
  and unpaired `server_tool_use` blocks the declining model wrote before its boundary, and drawn as
  it is stored

### A new tool

A tool the agent calls is its own, a module's or an integration's, and each kind takes what its
kind says, beside what every tool takes:

- **Every tool**:
  - a description saying when to call it, which is what the model decides by
  - its running and done labels in the `conversation` catalogue, in `getConversationToolLabel`,
    whose test names every tool
  - a result as JSON, cut at `MAX_TOOL_RESULT_LENGTH` (50000 characters) with a note, a long read
    paging itself well short of it, and a failure answered `is_error: true` with a sentence the
    model can act on, never one that fails the run
  - `eager_input_streaming: true`, which the agent's own tools declare in `CONVERSATION_TOOLS` and
    `toConversationModuleTool` gives a module's, so its input is checked before it runs, since it
    streams in unchecked
  - a place within ten calls a turn and fifty a run (`MAX_TOOL_CALLS_PER_TURN`,
    `MAX_TOOL_CALLS_PER_RUN`): a call past either is drawn failed, its result saying so, and never
    runs
  - whether it only reads: reads run four at a time beside the reads next to them, and a write or an
    integration call alone, so writes land in the order Claude made them. A tool reads only when
    running it twice changes nothing, which a module's says with `readOnlyHint`
  - whether a subagent gets it: `isSubagentTool` withholds the deletes and the Subagents module's
    tools from a subagent, which works with nobody watching, as `buildSubagentTools` withholds
    `ask_user`, nobody being there to answer, so a new tool that deletes or reaches subagents joins
    them
  - its bytes pinned: the conversation's and the subagent's tools are, so the list's tests move with
    it and the release costs every conversation its earlier reasoning once (`drop_block`), and
    `bun run probe:claude` runs after, since a list the API refuses fails every run
- **The agent's own**, in `CONVERSATION_TOOLS`: strict, within a request's 20 strict tools, 24
  optional and 16 union parameters, which `buildConversationTools.test.ts` holds it to, and run by a
  `ConversationToolRunner` (see The backend)
- **A module's**: registered by its module's server, as [Module conventions](#module-conventions)
  says, after the agent's own and not strict. Past some 10000 tokens of definitions Claude's tool
  search (`defer_loading`) keeps tools out of the context, and the list held 16017 from M33: a module
  added later weighs it (`documents/conversations.md` § Modules)
- **An integration's**: none. Integrations reach the agent through its three fixed tools, so what an
  organization adds never changes the list

### The data

A conversation is kept twice, once for Claude and once for the page, and
`documents/conversations.md` says how each is written:

- A file a member sends is a `ConversationAttachment`, uploaded before its message, into a draft's
  conversation as often as a saved one's, so its `conversationId` is a plain UUID nothing reserves.
  Every lookup, count and prune matches it with `userId` and `organizationId`, since another member
  who learned a draft's id could upload under it. Its row goes `UPLOADING`, reserved under the
  membership's lock before any byte is read, then `READY`, or `PRUNING` once a prune claims it, which
  no upload finishes and no send takes; its `message` is set once, by the mutation that sends it.
  The transcript holds it by its id in Claude's Files API, never its bytes, and a conversation's
  prune deletes its files' rows before its own, since `message` is nulled on delete

- The transcript, `ConversationTranscriptEntry`, is what Claude is sent: the exact content blocks
  of every turn, thinking blocks and their signatures included. Only the backend reads or writes
  it. It is append-only with one exception: Retry cuts the tail back to a run's anchor, which
  leaves a prefix the remaining thinking blocks were made with. Nothing else ever edits or deletes
  an entry, since Claude refuses a history changed under its thinking
- An entry's `content`, a run's `context` and its `pendingToolResults` are `String` columns holding
  the JSON text of exactly what was sent, never `Any`, so the transcript replays byte for byte.
  Data Connect stores `Any` as Postgres `jsonb`, which keeps one of two duplicate keys and refuses
  U+0000 in a string
- A run's `usage` is a ledger (`conversationRunUsage`): each request is reserved at its measured
  input before it is sent, in the fenced write that renews the lease (`RecordConversationRunUsage`),
  and settled from its answer with the model, why it stopped and where its part was stored. A worker
  taking a run over charges an unsettled request at its estimate. What a request came to, the turn
  to store or the run's end, is kept until it is written, so a refused write is tried again and never
  paid for twice. Every write of a run's `usage` sends what the ledger may have cost beside it
  (`toConversationUsageVariables`), which the write upserts as the run's `RunSpend` in its
  transaction: a new write of a run's ledger does the same, which the fake's `unpricedLedgerWrites`
  holds the tests to, and `RenewConversationRunLease`, the timer's, carries none
- A run's side request, today the one that tags a conversation's aspects
  (`requestConversationTagging`), goes through the same ledger, marked with its `purpose`: it stores
  no part, so its `turnPosition` stays null, which the readers of a turn's requests skip, and a
  takeover charges it at its own allowance. It never fails a run, and a run tries it once, as its
  ledger says. An aspects note belongs to no run, the agent's as the member's, so it counts toward
  no run's entries and a Retry keeps it
- A run stops at $10 (`CONVERSATION_RUN_MAX_COST_MICRODOLLARS`), held before each request, a side
  request's included: its ledger priced at list prices, each request no answer settled at the worst
  case its reservation recorded (`priceConversationUsageBound`), plus the most the request about to
  go can cost (`priceRequestWorstCase`), its input written to the cache, its whole `max_tokens` and
  five searches, each reading the input again from the cache and bringing back
  `WEB_SEARCH_RESULT_TOKEN_ALLOWANCE`, every earlier result read again by each later step. A request
  whose fallback would pass the limit or a daily spend ceiling goes without `fallbacks`, one that
  cannot fit fails the run with its limits' note, which chains a subagent's at the $10 and never at a
  ceiling, and tagging past either is recorded skipped. A stream cut partway counts at the most its
  model could write in the time it streamed (`priceCutRequestBound`,
  `CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND`), its reasoning being billed and never streamed, and at its
  reservation when it showed a fallback. A model a request names, or one a refusal may fall back
  to, joins `CLAUDE_MODEL_PRICES` and `CLAUDE_FALLBACK_MODELS` before it ships, which a test holds
  every request's model to, with `bun run probe:claude` after, which holds the fallbacks to the
  API's list and the allowance to what a search brings back
- Daily caps bound what a member starts (`MAX_DAILY_…` in strategydance-core): conversations, runs
  and subagents, in 24 hours, the member's in each organization, the account's across its
  organizations and the organization's, counted on `CappedStart` rows, which hold their organization
  as a plain id, so deleting it gets round nothing. Every mutation that starts one counts in its one
  query step, the member's after the membership's lock, and inserts its row last: a conversation's
  start, every run triggered `MESSAGE`, `ANSWER`, `RESUME`, `RETRY` or `REPORTS`, and a launch, never
  a subagent's own runs. Its domain function reads the counts first (`readReachedUsageCap`), after
  recognizing an action sent again, and a refusal of its mutation reads them again; a route answers
  429 with the cap's code and `Retry-After` (`respondUsageCapped`). An answer's continuation, an
  Allow's and a reaction pass a cap up to one and a half times it, then wait. A new way to start a
  conversation, a run or a subagent counts and records it the same way. The development backend
  lifts them (`IS_USAGE_CAPPED`, `USAGE_CAPPED=true` holding them there), through each mutation's
  optional `$isUsageCapped`, which left out holds them, as the tests and the check scripts do: a
  test or a check that builds past a cap lifts it in its fixtures
- Daily spend ceilings bound what a member's conversations cost (`MAX_DAILY_SPEND_MICRODOLLARS_…` in
  strategydance-core, $25, $50 and $150), over the caps' 24 hours and their three scopes, summed
  from `RunSpend` rows, which hold each run's `costBound` and their organization as plain ids, so no
  deletion gets round them. The worker holds every request to them where it holds the $10
  (`readRunSpendRoom`), and every start is held to them beside the caps (`readReachedUsageCap` with
  `spend`): a send, Resume and Retry answer 429 with the ceiling's code, a continuation and a
  reaction wait, a launch is refused with its sentence, a promotion leaves its runs pending and a
  chain ends its subagent with its report. A run a ceiling stops ends failed with its note naming
  the ceiling and when it has room (`ConversationMessage.ceilingScope`, `ceilingFreesAt`), which a
  page from before reads as the failed note. A new way to start, promote or chain a run reads them
  too, and a read of the caps or the ceilings hands its operation `{ organizationId, userId }` alone,
  as Data Connect refuses any variable it does not declare, which the fake refuses too there. They
  are lifted with the caps (`IS_USAGE_CAPPED`), the rows written anyway
- A member starts or continues a run only with a confirmed address and conversations not suspended:
  every route that starts or continues one, the send, an answer, an approval, Resume, Retry and a
  file's upload, mounts `verifiedEmailMiddleware`, which reads the ID token's `email_verified`, then
  `conversationsSuspensionMiddleware`, which reads `User.conversationsSuspendedAt` and
  `Organization.conversationsSuspendedAt`, after `organizationMemberMiddleware`, and a new one mounts
  both, while the stops, the reconciles and the reads mount neither. The development backend asks for no
  confirmed address (`IS_EMAIL_VERIFICATION_REQUIRED`, `EMAIL_VERIFICATION_REQUIRED=true` holding it
  there), and the route tests' viewer carries `isEmailVerified`. A suspension is read where a worker
  claims a run (`isClaimable`), never at the steps after, which would throw away a turn paid for, by
  a launch (`suspended`) and by a reaction, which waits: a new way to start a run that no member's
  route starts reads it too, or its runs are interrupted at their claim, each a run of the caps.
  Only `bun run suspend:conversations` writes the columns, through one transaction that locks the
  account's or the organization's row, then every membership it reaches, which every start of a run
  locks first, then asks every run in flight of theirs to stop. A start that must not commit for a
  suspended member reads the columns in its query step, after the membership's lock, as
  `StartSubagentReaction` does, since a suspension landing between a domain's read and its write is
  otherwise a run the claim refuses
- A turn `pause_turn` paused is held in memory until it ends, then stored as consecutive `ASSISTANT`
  entries, one write each, the first with the run's context message. A crash between two leaves
  the turn paused at its last stored part, which the ledger says, and the next worker sends its
  continuation. A part is one response of a paused turn; a piece is one slice of a reply past 20000
  characters, drawn as its own message, the entry's cursor keeping its piece (`drawnPieces`)
- The thread, `ConversationMessage`, is a drawing of the transcript, and what the page reads. Its
  messages are ordered by `position`, never by time, since two mutations can share an instant: a
  mutation that inserts messages first claims their positions on the conversation's
  `nextMessagePosition`, moving it on under `@check(this == 1)`, and a writer that loses the race
  reads it again and retries. The counter only grows, so a deleted message leaves a gap rather
  than a position used twice
- The page reads the thread in three parts: `GetConversation`'s live tail of the latest 150
  messages, carrying only what is small or changes in place (kind, position, run, a call's status,
  an answer), each message's body once by id through `GetConversationMessageBodies`, and older
  messages in pages through `GetConversationMessagesBefore`. `createConversationThread` merges
  them, and reads every page it holds again when `historyRevision` moves. A field that changes in
  place belongs in the tail, one that never changes once written in the bodies, and the history
  page carries both: a member's message's files, their id, name, type and size, are its body's,
  since the send that inserts it sets them. Their bytes come from `GET …/attachments/:attachmentId`
  alone, read with the reader's token past the browser's HTTP cache (`useConversationAttachmentFile`)
  and drawn from an address `useObjectUrl` holds while something draws them. An image drawn small
  is drawn from a small copy (`useImageThumbnail`), never its own bytes, which an `<img>` decodes
  whole whatever size it is drawn at
- A web conversation mutation takes the caller's own `$userId` and checks `vars.userId ==
  auth.uid` on its first, redacted step. The live conversation queries' refresh conditions match
  the author on it, `mutation.variables.userId == request.auth.uid`, since the backend's
  mutations, run through the Admin SDK, carry no `mutation.auth.uid` and take the verified
  `$userId` anyway
- A run is `QUEUED`, `RUNNING` or, a subagent's, `PENDING` exactly while its conversation's
  `activeRunId` names it, a `PENDING` run with no lease and no task. Every write that ends a run
  lets go of it in the same mutation, matching `activeRunId` on the run and never filtering on
  `deletedAt`, or a conversation restored later stays busy for good. A run's lease is set from the
  database's clock (`leaseExpiresAt_time`), the clock the filters that find it dead read: two
  minutes while it is queued (`CONVERSATION_RUN_QUEUED_LEASE_MS`, which every mutation that queues
  one writes out), then a minute, which every write of its worker renews. A claimed run
  past its lease is dead, and a route finalizes it as interrupted before it counts or starts
  another, as the page's reconcile does. A queued run's lease only says when to ask Cloud Tasks
  whether it is still coming (`finalizeDeadConversationRun`): its task there, the lease is pushed
  back; gone, the run is queued again while it is under twenty minutes old, and finalized once
  older, so a run whose task never came, its process gone between storing it and queueing it, is
  queued again within minutes, by its page or the worker's reconcile. A run whose task could not be
  queued has its lease brought in to now, so its page reconciles it at once. Development has no
  queue, and a queued run past its lease is dead there
- Every write of a worker is fenced: its first step is the run's own update, matching the run
  `RUNNING`, the attempt its worker claimed and its author's membership by the `createdAt` the run
  recorded, as `RenewConversationRunLease` does alone. It is the run's only write in the mutation,
  so its end, its step and its lease ride in its data. A worker whose run was claimed again, or
  whose author left or was invited back since, writes nothing more. A `Timestamp` read back from
  Data Connect keeps its microseconds and matches itself in a filter, which is what that match
  relies on, and `check:conversation-runs` checks it
- A message the backend draws takes an id derived from what it is drawn from
  (`deriveConversationMessageId`): a transcript entry with its first block and its piece, or a run
  with its note. A worker taking over after a crash draws from the entry's cursor, `drawnBlocks`,
  and derives the same ids, so drawing a message twice is a conflict rather than a copy. The
  member's message keeps the browser's id, which makes a retried send store it once, and names the
  run it started, so a Retry deletes a run's messages but that one. Drawing finds an entry by its
  id and cursor, never by the run that stored it, so a resumed run draws what the run it carries on
  left undrawn, under its own name
- A member stops a run through its `stopRequestedAt`, which its worker reads before each request and
  every two seconds while one streams (`createConversationRequestSignal`); a turn already answered
  is still stored and drawn, since it was paid for. A queued run is stopped by the route at once.
  Resume deletes the stopped or interrupted note, the thread's newest message, and moves no
  `historyRevision`, so it refuses once anything follows the note; Retry cuts the transcript after
  the run's anchor and deletes the messages of every run on that anchor, so it moves
  `historyRevision`, and every tab reads its pages again. Both start a run on the same anchor, and a
  route that receives either again answers with the run numbered right after the one it names
- Every run that ends with a note says why in its `failure`, for the logs, and
  `FinishConversationRunWithNote` pairs each status with its own note: failed with failed or full,
  stopped with stopped, refused with refused
- Conversations are searched by the backend alone, `POST …/conversations/search`, since what a
  search finds is messages, which no web query could group by conversation. `Conversation.title`
  and `ConversationMessage.text` are `@searchable(language: "simple")`, which splits words and
  lowercases them in every language the app speaks and stems nothing, read with
  `queryFormat: PLAIN`, which needs every word. A `_search` is ordered by its relevance alone:
  its `orderBy` cannot name it. A query holding Chinese or Japanese, which put no space between
  words, matches by substring instead (`isSubstringSearchQuery`), over every title and the
  messages of the most recently active conversations to 20000. Only member and agent messages
  are searched, never a question, a tool call or a note
- A subagent is a conversation with a `parent`, the conversation whose agent launched it with a
  brief (`launchSubagent` in `domain/subagents/`), its member's and run as theirs, and hidden from
  them. Every read or count of a member's conversations leaves subagents out with `parentId: {
  isNull: true }`: the list, the badge's and the dock's reads, the searches, the counts
  `MAX_CONVERSATIONS` and `MAX_ACTIVE_RUNS_PER_MEMBER` hold and the runs in flight a route reads
  first. Every way a member acts on a conversation refuses one, the send, answer, approval, Resume,
  Retry, Stop, reconcile and upload routes, `missing` in the domain and the same filter in the
  mutation, and the web's delete, restore, read and aspects mutations, while a read of one
  conversation by its id reads one as any other. A new read, count or action of a member's does the
  same. A subagent's run sends `SUBAGENT_SYSTEM_PROMPT` and `buildSubagentTools`, both pinned by
  their bytes, the agent's own tools but `ask_user` among them, asks nothing, tags nothing, draws its text with no unread count
  (`DrawSubagentAgentText`), and ends only through `FinishSubagentRun`, `FinishSubagentRunWithNote`
  and `InterruptSubagentRun`, which write its `report` in the write that ends it, however it ends:
  every other ending's fence matches a conversation that is no subagent, and a dead one only through
  `InterruptDeadSubagentRun`, which `finalizeDeadConversationRun` writes when told of a run on the
  subagents' queue, answering `missing` for a subagent's run on the conversations' and the reverse.
  `bun run check:subagent-runs`, in the backend's package, checks the operations against the
  emulators
- A parent's page draws its subagents from `GetConversationSubagents`, live, read once its
  `subagentCount` says it launched one: each launch's row finds its subagent by the call's
  `toolUseId`, which the bodies carry, as the subagent's `launchToolUseId`, the strip above the
  composer counts them, and Retry counts those launched on its run's anchor (`launchAnchorPosition`),
  which it discards. A subagent's runs write under its own id, never the parent's, so the list
  refreshes on each of them under the member and the organization, and on the parent's own writes,
  its launches, stops, Retry, delete, restore and every delivery of its reports, under the parent's
  id: a new write that changes a subagent's row or the status of its latest run names itself there.
  A subagent's thread is drawn read only, in its viewer (`ConversationSubagentDialog`), which
  `conversation.parentId` decides: no reconcile of its own run, whose route refuses it, no note
  actions, and notes worded for a subagent. Its brief's files are the parent's, read by
  `attachmentIds` among the parent's sent files (`GetConversationBriefAttachments`) and served under
  the parent's id. No page polls a subagent's run, so the parent's page reconciles the member's
  subagents (`useReconcileConversationSubagents`) every two minutes while one is busy, and a few
  seconds in once a batch has reported whole while the parent could react, its timer keyed on its
  delay alone
- A subagent's run at one of its limits, its 25 requests, 10 minutes or 100 entries, before its
  fourth run (`MAX_SUBAGENT_RUNS`) chains: `ChainSubagentRun` ends it `CHAINED` and queues the next,
  `CONTINUE` on the same anchor, in one write, the next run's id derived from it
  (`deriveChainedRunId`), carrying on as Resume does without a note. A run asked to stop as it
  reaches a limit stops instead. The worker queues the next run once its lease has stopped, and a
  run whose next could not be queued answers `held`, so its delivery comes back to queue it, as a
  delivery finding the run `CHAINED` does. The calls count 50 for each run of the chain
  (`planConversationToolCalls`' `maxCalls`). The fourth run's results entry ends asking for the
  report (`SUBAGENT_REPORT_REQUEST`) once any of its budgets nears its end (`isSubagentReportDue`):
  its 24th request, two minutes left of its ten, 95 entries, or a next request whose worst case leaves
  no room for another, within the $10 or what the daily spend ceilings leave it. Once asked, that request, its last, goes past the requests, the entries and
  the ten minutes until 12 minutes after the claim (`readSubagentReportDeadline`), its cost held as
  any request's, and nothing its reply calls runs. Only the last run writes the report
- A member has five subagent runs at once in an organization
  (`MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER`), `QUEUED` or `RUNNING` across all their conversations,
  apart from their own three. A launch first finalizes their dead subagent runs, then takes a free
  slot (`LaunchSubagent`, whose check refuses the sixth) or waits `PENDING`
  (`LaunchPendingSubagent`), and a pending launch promotes right after, so a slot freed while it
  counted goes to the oldest run waiting. The promotion is a mutation of its own, one run at a time
  (`PromoteSubagentRun`, looped by `promoteSubagentRuns`), taking the membership's lock after
  whatever freed the slot, never inside it: after every end of a subagent's run that held a slot and
  every dead one finalized, never after a chain, which keeps its slot, nor after a `PENDING` run's
  end, which held none. It skips a run asked to stop, one whose subagent is deleted and one launched
  under a membership since replaced, which the reconcile and the sweep end through
  `StopPendingSubagentRun` and `InterruptPendingSubagentRun`, each fenced on its reason:
  `GetSubagentPendingRuns` reads the runs it may promote apart from those it skips, filtered in the
  query, so no number of runs skipped hides one it may promote, and a read of runs waiting filtered
  in code would. A promotion refused is read again, and a run found queued is queued, since its
  answer may be what was lost. A promotion sets the run's `createdAt` again, so its twenty minutes
  to be queued again count from there. A new way to end a subagent's run that held a slot promotes
  after it. `POST …/:conversationId/subagents/reconcile`, which a parent's page calls, and the daily
  sweep (`sweepSubagentRuns`) reconcile a member's subagent runs (`reconcileSubagentRuns`): the dead
  ones finalized or queued again, the skipped ones ended, a hundred at a time until none is left,
  then a promotion
- A parent reacts to its subagents' reports in a run of its own, triggered `REPORTS`, the first run
  no member started (`reactToSubagentReports` in `domain/subagents/`): once every live subagent of a
  batch, those its runs launched on one anchor, has reported and the parent is idle, its latest run
  `COMPLETED` and nothing waiting. `StartSubagentReaction` takes the membership's lock, counts the
  member's three runs, writes the parent's row under `activeRunId` null and the run number read, and
  marks exactly the reports its entry carries delivered (`reportDeliveredAt`), so two subagents
  ending at once start one reaction. Its entry holds one JSON block per report
  (`buildSubagentReportBlock`, `{"subagentReport": {...}}`), which the thread draws as nothing, and
  the run counts toward the three like any of the member's. A report names the first 20 of the
  subagent's module writes and of its calls to integrations, with their totals, in the key order the
  system prompt names, and `read_subagent` pages the writes and lists every call: the calls are those
  that started (`GetSubagentIntegrationCallsForAgent`), each with its server, its tool and how it
  ended, since a call to another company's server is what no restore undoes: a call that failed
  without its server refusing it before running it, its address, its credential, a refusal it
  answered or a 4xx, is recorded as unanswered on its message (`isToolUnanswered`, from
  `IntegrationCallUnanswered`), since it may have run, which its duration cannot say: one that timed
  out, found no server, was interrupted or brought an answer that could not be read. A subagent's end starts its parent's;
  any other run's end, the route-side ones included, starts the member's oldest due
  (`startDueSubagentReactions`), its own conversation's first; the subagents' reconcile route and
  the daily sweep (`sweepSubagentReactions`) start them too, the sweep every one. A new way to end a
  member's run starts their reactions due after it. A reaction launches and deletes nothing:
  `LaunchSubagentForAgent` refuses a `REPORTS` launcher, and `delete_document` and `delete_task` read
  the caller's launcher (`isReactionCaller`) and refuse one, telling the agent to ask the member
- A member's send carries every finished report not delivered yet, after the turn's results and
  before the file names, files and text, those of a batch still working included, and an answer's
  continuation, and the results entry an Allow's run stores, carry them after every result. Each
  names exactly what it marks delivered, `$deliveredSubagentIds`, counted as `$attachmentIds` is,
  and is always called with the list, empty when nothing waits, since a write leaving it out is
  refused while a report waits. Resume and Retry carry none. A parent ended with the full note takes
  no report: `FinishConversationRunFull` marks every report waiting delivered as it ends, and a
  report that comes after is marked with no run (`MarkSubagentReportsDelivered`), from whatever reads
  the parent full, the subagent's end, the reconcile or the sweep
- Every write on a parent and its subagents keeps one lock order: the membership, the parent's runs,
  the parent's row, its subagents' runs, then their rows, and each reads its lock's response, so its
  steps run apart and whichever of a launch and a cascade commits second sees the first. The
  subagents' stops take the membership's lock to read its response, the suspensions read the runs
  through the locked account's or organization's, and the web's `DeleteConversation` reads its
  subagents through its membership read. The parent's Stop asks its anchor's live subagents to stop in the
  same write (`RequestConversationRunStopWithSubagents`, `StopQueuedConversationRunWithSubagents`),
  Stop all and a row's Stop go through the parent's routes (`POST …/subagents/stop`, `POST
  …/subagents/:subagentId/stop`), Retry stops and deletes the cut runs' subagents at an instant of
  their own, and the web's `DeleteConversation` writes the parent's runs before its row, then its
  live subagents at its own instant, which `RestoreConversation` brings back by, reading it through
  `response`. Each that freed a slot ends the queued and waiting runs at once
  (`stopConversationSubagents`) and promotes after. The sweep prunes a parent's subagents before it,
  only once idle, lowering a remaining parent's `subagentCount` (`PruneClaimedSubagents`).
  `check:conversation-runs` reads the order off the mutations themselves, since PGlite serializes
  every race: a new write on a parent keeps it
- `bun run check:conversation-races`, in the backend's package, races the runs' bounds and cascades
  against a real Postgres: one run per conversation, three in flight, five slots, promotions,
  reactions, a stop beside a chain, a delete beside a launch and a suspension beside a send, each
  the backend's own writers released at once, many rounds over, printing the interleaving of a
  round that fails. It never runs in CI: run it before a release that changes a run's mutations, as
  `probe:claude` runs before one that changes a request. It needs Docker, where it starts a
  throwaway Postgres, with four emulators on it behind a proxy, since one emulator runs one
  operation at a time on any database (`withPostgresEmulators.ts`), on ports beside the person's
  stack. `bun run emulators:postgres` serves the same until Ctrl-C, for any check pointed at it
- A domain function hands an operation only the variables it declares: Data Connect refuses one it
  does not, which the fakes let through, so pass a member as `{ organizationId, userId }`, never a
  run reference that carries more

### The backend

- Claude reads a conversation's files through Anthropic's Files API (`ClaudeFiles`, the placeholder
  standing in under `CONVERSATION_AGENT=placeholder`), where the upload sends each once. Its files
  are the workspace's, and development and production read the same key: every file is named
  `CLAUDE_FILE_NAME_PREFIX` and its attachment's id, never the member's name for it, and only
  production's sweep deletes the files no row names, under its own prefix. The count endpoint takes
  no Files API source, so a file is counted once from its bytes when it is stored, into
  `tokenCount`, and every measurement takes file blocks out and adds those counts
  (`replaceConversationFiles`)
- Conversations' routes sit in `routes/conversations.ts`, mounted at
  `/organizations/:organizationId/conversations` with `mergeParams`, and each runs
  `organizationMemberMiddleware`. A send
  queues a run, and `enqueueRun` sends it on its way: in development it starts in the backend's
  own process, and in production (`ARE_CONVERSATION_RUNS_IN_PROCESS` off) a Cloud Tasks task named
  after the run, `run-<runId>` on the `conversation-runs` queue, delivers it to the worker's
  `/internal/conversation-runs`, whose request stays open for the whole run, since Cloud Run
  throttles the CPU once a response is sent. Queueing it twice queues it once (`ALREADY_EXISTS`),
  and a run that could not be queued stays queued while the send answers 503
- A subagent's run goes through a queue of its own, `subagent-runs` (`SUBAGENT_RUN_QUEUE_PATH`, 20
  deliveries at once), to the same worker route, so a fan-out never holds the deliveries every
  member's reply waits on. Cloud Tasks takes a task's name only under the queue it was created in,
  so a run's queue (`ConversationRunQueue`) is a required argument of everything that touches its
  task, `enqueueRun`, `queueConversationRun`, `buildConversationRunTaskName`,
  `findConversationRunTask` and `finalizeDeadConversationRun(s)`, and a new one takes it too
- A search of conversations is metered twice, both refusing with `ERROR_CODE_TOO_MANY_REQUESTS`:
  `createConversationSearchRateLimitMiddleware` counts a caller in the instance's memory, one
  limiter a router, and `RecordConversationSearch` holds the same 120 in ten minutes across
  instances, per member and organization, under a lock on the membership, in `ConversationSearch`
  rows. The query travels in the body, never the address, and is never logged
- A worker's writes go through its run's lease (`createConversationRunLease`), one after the
  other, so they land in the order it made them and never beside a renewal of its own, and its
  steps are read afresh each time (`runConversation`), so taking over after a crash follows the
  same path as carrying on
- What a run asks Claude lives in `domain/agent/`. Claude is reached through a `ClaudeClient`: the
  real one on Anthropic's API, the placeholder `CONVERSATION_AGENT=placeholder` picks in
  development, and the tests' scripted one, which records each request's bytes and refuses to count
  a Files API source, as the endpoint does. Every request is
  built by `buildConversationRequest`, in one key order, so the next request starts with the last
  one's bytes, and passes `checkTranscript` before it is sent. The system prompt is pinned by its
  hash, and so are the tools a request sends (`buildConversationTools`): a change to either costs
  every conversation its earlier reasoning once, as `drop_block` lets a replay do, so it ships with a
  release that means to. Load the `claude-api` skill before writing code that calls Claude
- A tool the agent calls is its own, declared in `CONVERSATION_TOOLS` beside Claude's web search,
  or a module's (see [Module conventions](#module-conventions)). Each is run by a
  `ConversationToolRunner`, the modules' from the connection a run opens once it is claimed
  (`connectConversationModules`): its name, whether it only reads, which lets it run four at a time
  beside the reads next to it, and a `run` that checks its input, since Claude's streams in
  unchecked, and answers JSON or throws a sentence Claude can act on. A write the worker stops
  waiting for is answered as one that may still have run. What becomes of each call is planned from
  the transcript alone (`planConversationToolCalls`),
  so a worker taking over plans the same; each call starts and finishes in fenced writes, its result
  kept on the run in `pendingToolResults` until the entry answering the turn is stored; and that
  entry, for the worker, an answer's continuation and a send alike, comes from
  `buildConversationToolResults`, one result per call in the turn's order. `ask_user` is answered by
  the member instead: only the turn the transcript ends on holds questions without an answer, so
  what waits is the conversation's (`isAwaitingAnswer`), never a question's run's
- The organization's integrations, other companies' MCP servers, reach the agent through three tools
  of its own, always in `CONVERSATION_TOOLS` and always run, whatever the organization added, so the
  tools list never varies and a turn is replanned the same: `list_integrations` and
  `describe_integration_tool`, strict, and `call_integration_tool`, which is not, since a strict
  schema cannot leave its `arguments` open, its input checked by `checkConversationIntegrationCall`.
  Their runners (`createConversationIntegrationRunners`) close over the run's fence, as the modules'
  connection closes over its caller, and a call is made through `callIntegrationTool`, 30 seconds in
  all, as the member, a 401 alone marking their connection
- What a call to an integration becomes is decided once, when it is drawn, from the server as it is
  then (`decideConversationIntegrationCall`): refused, drawn failed with the server it named; run at
  once, when an administrator lets its tool run without approval; or an `APPROVAL` the member allows
  or denies. A subagent's that would wait is drawn failed instead, since nobody can approve one, its
  result asking it to say in its report what it would call, so a subagent never waits and its parent
  proposes the call. Both of the last two are bound to the server's `configRevision`, the tool's
  definition hash and the credential's generation, recorded on the message, which Allow and the call
  right before it is made check again, the run carrying a subagent on included: a mismatch denies an
  approval, its result saying the server changed.
  An approval waits as a question does, in every waiting count (`kind in [QUESTION, APPROVAL]`, not
  answered), its `toolStatus` null until a run starts its call. A turn's other calls run beside it, as
  David chose. A call to an integration that started is never made again: one a crash or a stop left
  unfinished is finished as interrupted
- A continuation that carries an allowed call stores no entry, since the call has not run:
  `ContinueConversationRunWithCalls` starts its run anchored where the waiting run was, with its
  results, and answers the calls a stop kept from running as stopped; the worker makes the calls,
  then stores the turn's results and anchors the run on them (`StoreConversationToolResults`'
  `$anchorPosition`), so a Retry keeps a call that went to another company's server. A send denies
  the approvals waiting and answers an allowed call never run, each by a list it names, which a
  backend from before leaves out and is refused for
- The conversation domain's tests run against `createConversationDatabaseFake`: the backend
  connector's conversation operations over tables in memory, each mirroring its namesake's
  conditions and refusals. It holds the modules' fake as `modules`, and the integrations' as
  `integrations`, their operations in the same SDK, since a run's worker loads every module's server
  and its agent reads the organization's servers, and adds or removes a member in all with one
  `createdAt`; a test bringing its own runners in passes `connectTestModules(runners)`. `bun run check:conversation-runs` and `bun run check:conversation-search`,
  in the backend's package, check those conditions against the emulators, the second also what
  Postgres' full-text search and LIKE match. An operation changed is changed in both

### The page

- The dock's windows are each member's in each organization, kept by `_ConversationDockProvider`
  under one persisted key, each set under `${userId}:${organizationId}`, since the key a persisted
  state reads is read once. A minimized window reads nothing but `GetDockConversations`, the
  conversations the windows hold, at most 20, which refreshes on every mutation that changes a
  conversation's title, `activeRunId`, `unreadCount` or `isAwaitingAnswer`, or whether it is there:
  a new one joins its refreshes, or a minimized window's count stands still. An open window draws
  the page's own thread and composer, which mark replies read as the page does. A composer's message,
  its mentions, its files, where its send stands and the run the reader last started are kept by account,
  organization and conversation for the life of the tab (`~data/conversationComposerDrafts`) and shared by every view
  drawing it, so a conversation drawn again, on its page or in a window, carries on where it was:
  anything new a message holds goes there too, never in a view's own state. A file's upload is the
  tab's, not a composer's: it runs in `~data/conversationAttachmentUploads`, three at a time, and
  writes how far it has gone into the draft it was added to, so it goes on wherever the
  conversation is drawn, and removing the file anywhere stops it.
  A question's answer under way is kept the same way (`~data/conversationQuestionAnswers`), and
  anything else a reader has under way in a conversation joins them on `createTabStore`
- A conversation's thread scrolls the window on its page, and a box of its own in a dock's window,
  `scrollerRef`: whatever scrolls the thread, or measures what the reader sees of it, takes that
  box, through `readConversationViewport` and `scrollConversationToEnd`, never `window` directly

A subagent has no page of its own. Its address sends the reader to its parent's page with its work
open over it, `?subagent=<hyphenated id>` (`ConversationSubagentBouncer`, under
`ConversationBouncer`), before anything of the page draws, so no composer or title ever shows for
one. View work pushes that search as a step of the history, with `isFromConversationThread` in its
state, so Back closes the viewer and closing it steps back, as a task's dialog does over the board.

## Module conventions

A module is one of Strategy Dance's capabilities served as an MCP server, which Strategy Dance's
agent uses in its own process and which a member can add to an agent of their own: Knowledge and the
team's tasks first, then Subagents, which Strategy Dance's own agents alone reach, the rest later.
`MODULES` in strategydance-core lists each one's name, path, title and scopes, `SERVED_MODULE_NAMES`
beside it those served to external agents, and [conversations.md](documents/conversations.md) §
Modules says what each does and why.

- A module's server lives in `src/modules/<name>/`, built by its `create<Name>Server(caller)` for one
  caller, one file per tool registering it, which only validates, calls `domain/<name>/` and shapes
  the result. `src/modules/` holds the frame: `MODULE_SERVERS`, by the module's name, and
  `createModuleHandler`, the SDK's `createMcpHandler` around it, which builds a fresh server for
  each request, answering JSON, statelessly. Strategy Dance's agent and the public endpoint both go
  through that one handler, so they get the same tools and checks. What every module's tools share
  sits beside it, `readModuleWriteCall`, `createModuleAddresses` and `moduleSchemas`, and in
  `domain/modules/` the call results and `isOperationRefusal`: a module adds its own to them rather
  than copy them
- A module is worded for members in the web's `module` catalogue, by its name, through
  `getModuleMessages`, typed over every `ModuleName`: a module added to `MODULES` fails the
  typecheck until its name, what its read and write access let an agent do, and the tooltip of its
  page's agents button are worded there, for the consent page, the Connected agents tab and that
  button. `MODULES`' `title` is the server's own, in English, for what MCP clients show
- The caller, `ModuleCaller`, is verified before a server is built and reaches it in the `extra` of
  the SDK's `AuthInfo`, which `toModuleAuthInfo` writes and `readModuleCaller` reads back, refusing a
  request that carries none. Nothing in it comes from a tool's arguments. Every operation a tool runs
  matches the membership on the `membershipCreatedAt` the caller carries, so a member removed, or
  removed and invited back, stops every agent acting as them at its next call. Its `launcher`, the
  run calling, `{ conversationId, runId }`, is filled only by a worker that has claimed a run, from
  that run, and every Subagents tool refuses a caller without one, before anything is read, though
  the module lists its tools to it. `readModuleCaller`'s schema is strict: a field the caller gains
  joins it, or every call carrying it is refused
- A tool's name is snake_case, as Claude takes a tool name (`^[a-zA-Z0-9_-]{1,128}$`, no dot,
  though MCP allows one), and unique across the modules and the agent's own tools, since the agent
  puts them all in one list: `moduleServers.test.ts` fails on a clash between modules. The order a
  module registers its tools in is the order the agent lists them in, frozen as the agent's tools are
- A tool takes a zod input schema and an `outputSchema`, answers `structuredContent` with the same
  JSON as text (`toToolResult`), carries annotations, `readOnlyHint` on reads, `destructiveHint` on a
  delete and on a write that can rewrite what it changes whole, as `update_document` can,
  `openWorldHint: false` on all, and refuses with a result, `isError` and a sentence the
  model can act on (`toToolRefusal`), never a protocol error. The SDK answers an input that fails its
  schema the same way. Annotations reach external agents' clients alone: Claude's tool list keeps a
  module's name, description and input schema (`toConversationModuleTool`), so changing one moves
  no pinned bytes
- Every write takes an idempotency key in the call's `_meta`, under
  `com.strategydance/idempotencyKey`, and its mutation inserts its `ModuleCallResult` first, under
  `@include(if: $isKeyed)`, in the transaction that writes: a key taken refuses the write, and the
  module reads the row back, the same tool with the same arguments, hashed as canonical JSON,
  answered with the stored result and anything else refused. The scope is the caller's,
  `conversation:<id>` or `connection:<id>`, never the client's. A write also checks the caller's
  write scope before anything is read
- Strategy Dance's agent reaches the modules `CONVERSATION_MODULES` lists, in `MODULES`' order, in
  process: each run's worker connects to them once it is claimed (`connectConversationModules`), as
  the run's member, every scope, through the module's own handler, by the SDK's client pinned to the
  2026-07-28 revision on a transport whose `fetch` hands each request to the handler. A module's
  tools join the request after the agent's own as streamed Claude tools that are not strict
  (`toConversationModuleTool`), each schema as the module wrote it, less the dialect it names, so
  Claude reads its bounds and patterns, and the module's own schema checks every call, answering one
  it refuses with a sentence the model can act on, as it answers an external agent. A request takes
  at most 20 strict tools, 24 optional parameters and 16 union ones across them all, which the
  modules outgrew in M17: only the agent's own tools are strict, and
  `buildConversationTools.test.ts` holds them to those limits. A module's schema still has to be one
  the API takes: run `bun run probe:claude` whenever a module's tools change, since a list it
  refuses fails every run. The connection carries the claimed run as the caller's `launcher`, which
  the Subagents module reads; a send's or a launch's measurement connects without one. A subagent's
  worker sends none of the Subagents module's tools nor the deletes, by name (`isSubagentTool`), and
  plans a call to one as a call to a tool nobody runs. A subagent's requests carry settings of their
  own, `SUBAGENT_REQUEST_SETTINGS` beside its tools, a model, an effort and a task budget, which a
  change of is a change of its request alone
- The agent keys each write with Claude's id for the call, under `conversation:<id>`, so a worker
  taking over or a Resume calling it again is answered from its key. Finalizing a dead run, and a send
  or a continuation answering its calls, read the key of each write it left started
  (`settleConversationModuleWrites`): a stored result is the call's, recorded `SUCCEEDED` through
  `SettleConversationToolCall`, which refuses while a run holds the conversation, and anything else
  is answered as a call that may have run
- What a module reads and writes goes through backend-connector operations named `…ForAgent`, which
  take `$userId` and `$membershipCreatedAt` and hold to the AI permissions for every caller, Strategy
  Dance's agent and a member's own alike: a document whose `isAiReadable` is off is never loaded,
  whatever the call, and one whose `isAiWritable` is off is never changed. Tasks carry no AI
  permission: the board is the team's, and any agent changes any task as any member can. Each write
  is named in the refreshes of the live queries whose rows it changes, in a web query too, since a
  mutation the backend runs fires them
- The tests drive a module through the SDK's `Client`, pinned to the 2026-07-28 revision, on a
  transport whose `fetch` hands each request to the module's handler with the caller as `authInfo`
  (`createModuleTestKit`, which takes the module's name), never the SDK's in-memory transport, which
  speaks only the 2025 revisions. They run against `createModuleDatabaseFake`, the operations over
  tables in memory: one base holding the memberships and the call results, to which each module's
  fake, `createKnowledgeDatabaseFake` and `createTasksDatabaseFake`, adds its own, since a module's
  handler loads every module's server and Bun refuses an import the mock does not hold. A new
  module's fake joins it. The Subagents module is the exception: its domain is the conversation
  runtime, so each of its tools imports `domain/subagents/` inside its handler (`await import`),
  which no other module's server, nor the modules' fake, then loads, and its tests run against
  `createConversationDatabaseFake`, which holds the modules' fake and every subagent operation. A
  module whose domain needs the conversation runtime does the same. `bun run check:knowledge-module`,
  `bun run check:tasks-module` and `bun run check:subagents-module`, in the backend's package, check
  those conditions against the emulators: an operation changed is changed in both
- An external agent reaches a module at its address, `https://api.strategydance.com/mcp/<name>`,
  `/mcp/knowledge` and `/mcp/tasks` today, each its own OAuth resource, so one module's token never
  opens the other, once a member allowed it on the consent page, through the modules' endpoints (see [Backend
  conventions](#backend-conventions)). Its caller comes from the access token,
  `createAgentConnectionTokenVerifier` reading it on every call: `kind: 'external'`, the token's
  scopes within its connection's, the scope `connection:<id>`, and the membership's `createdAt`, so a
  member removed or an agent disconnected is stopped at its next call. A
  verified token marks its connection used, `lastUsedAt`, at most once a minute
  (`createAgentConnectionUseRecorder` in memory, `RecordAgentConnectionUse` across instances), which
  no live query refreshes on
- A served module's write tools each register `scopeChallenge: requireModuleWriteScope(module)`, so a
  connection granted read alone still lists every write, and a call to one answers 403
  `insufficient_scope`, naming the write scope and the resource metadata, as MCP's step-up asks: the
  client asks the member again, and their new consent replaces the connection. `readModuleWriteCall`'s
  check stays behind it, a second guard. An external agent's search, a Knowledge `search_documents`
  or a `list_tasks` with a query, each page of it, draws on the member's search allowance
  (`recordModuleSearch`, in `domain/modules/`), which their conversation searches use too, since no
  run bounds it, and one past it is answered with a result saying when to search again
  (`toTooManySearchesSentence`) and which read still works
- A module joins the external agents with its name in strategydance-core's `SERVED_MODULE_NAMES`,
  which mounts its endpoint and its metadata, lets the metadata answer any origin, and lets the
  authorization server and the consent page take it: `parseModuleResource`, the metadata's
  `scopes_supported` and the consent page read the served modules alone, so a module in `MODULES`
  but served to nobody, as Subagents is, is refused as an address no module has. It takes besides
  `requireModuleWriteScope` on every write tool; its searches on the member's allowance; the agents
  button on its page, `ModuleAgentsButton`, an icon after the page's own action, which takes its
  name and opens the dialog worded from the `module` catalogue; and its endpoint in `check:oauth`.
  Knowledge joined in M20 and Tasks in M21
- `bun run mcp:knowledge <email>` and `bun run mcp:tasks <email>` serve a module over stdio for a
  client on this machine, against the emulators only, through one script, `serveModule.ts`, which
  takes the module's name. stdout is the protocol's there, so the script points the logger's info
  lines at stderr. The local backend serves a served module over HTTP too, as its own issuer, with
  the consent page on the local web app: `claude mcp add --transport http
  strategydance-knowledge-http-local http://localhost:3003/mcp/knowledge` and `claude mcp add
  --transport http strategydance-tasks-http-local http://localhost:3003/mcp/tasks`, then `/mcp` in
  Claude Code to sign in to each
- `bun run backfill:document-text --production` and `bun run backfill:task-text --production`, in
  the backend's package, fill the plain text of documents stored before `contentText` existed and of
  tasks stored before `descriptionText` did, and `bun run backfill:task-done-at --production` stamps
  the tasks done before `doneAt` existed with their last change, each run by hand once, after the
  release that added it
- `bun run suspend:conversations --production <email | organization id or slug> [--lift]`, in the
  backend's package, is staff's suspension of an account's or an organization's conversations, and
  `bun run report:usage --production [--days <n>] [--workspace-usage <dollars>]` what conversations
  cost from the runs' ledgers, by organization and by account, with each daily spend ceiling's scope
  over the last 24 hours against it, which the decisions left for the recorded usage are taken with. The second reads through the Admin SDK's own GraphQL, so it reads
  production whatever its release. `finalizeDeadConversationRun` logs a line beginning with
  `DEAD_RUN_LOG_PREFIX` for each run it ends, which a log-based metric counts and an alert watches
  (Setup 13 in conversations.md): its words change with the metric's filter

## Email conventions

`packages/strategydance-emails` holds the transactional emails as React Email templates. It
renders and nothing else: each `renderXEmail` takes props and answers `{ senderName, subject,
html, text }`. It owns no key and opens no socket, so the delivery provider and its secret stay
on the backend's side.

- Everything comes from the one `react-email` package, components and `render` alike. Version 6
  deprecated `@react-email/components` and the per-component packages
- `src/emails/` holds templates and nothing else, because the preview server treats every file
  there as one. Shared pieces go in `src/components/`. A template sets `PreviewProps`, which is
  what the preview renders it with
- Styles are inline style objects only. Gmail and Outlook strip `<style>` blocks and know no CSS
  variable, so the design system's tokens are copied into `src/constants.ts` as literals. The
  one `<style>` block is `EmailLayout`'s font face, which a client may drop at no cost.
  react-email's `Font` is not used: it also sets every element's family to the face
- Images, the mark included, are hotlinked PNGs at an absolute production URL, from
  `packages/strategydance-web/public/assets/images/`. Gmail and Outlook render neither inline
  SVG nor a `data:` URI. A new image shows as broken, in the preview server too, until a release
  has deployed it
- The backend's `tsc` follows its import into these `.tsx` files, so both tsconfigs carry
  `"jsx": "react-jsx"`, and their other options agree. Keep them agreeing
- English only for now. The copy follows the catalogues' rule anyway: no em dashes
- `bun run dev:emails` opens the preview server through `scripts/devEmails.sh`, which runs the
  CLI from a scratch directory outside the tree. Read its header before changing how it is
  invoked. The preview is indicative: check a real client before trusting a layout change

## Tackling a task

"Tackle task 123", or anything worded like it, names a task of the team's own board in Strategy
Dance: read it through the Strategy Dance MCP, the `strategydance-tasks` server, which is the
production Tasks module at `https://api.strategydance.com/mcp/tasks` acting as the person, never
the `-local` ones of [Module conventions](#module-conventions), which serve the emulators' board.
Then do what it asks as any other task, [Workflow](#workflow) included.

- What follows "task" is whatever the person copied: the task's id, which `read_task` takes
  hyphenated or not, or else a piece of its name, which `list_tasks` finds with `query`. A piece
  that matches several tasks is a question for the person, never a pick. Several tasks named at
  once are each tackled the same way
- Its description, which `read_task` answers in Markdown, is the brief. A `task:<id>` link in it
  is another task, which `read_task` opens too, and a `doc:<id>` link a knowledge document, which
  the Knowledge module's `read_document` opens where the session has it. A task it waits on that
  is not done yet blocks it, which is worth saying before the work starts
- When the session has no `strategydance-tasks` tools, or they ask to sign in, say so and stop
  rather than guess the task: the person adds the server with `claude mcp add --transport http
  strategydance-tasks https://api.strategydance.com/mcp/tasks` and signs in with `/mcp`
- Once the work starts, the task is under way: `update_task` moves it to `ONGOING`, from whatever
  column it is in, before the first edit, so the team sees it taken up. One already in `ONGOING`
  stays where it is
- Once its pull request merges, the task is done: `update_task` moves it to `DONE` as soon as the
  session learns of the merge, from `bun run review open` reporting `MERGED` or from the person,
  and the person is told of the tasks its answer says can start now (`canStartNow`). Nothing else
  on the board changes unless the person asks, since the server writes as them

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
commands and its reviewer: sunshine is private and keeps Copilot, strategydance is public and has
CodeRabbit, free there. `scripts/ship.sh` is the same file in both, and `scripts/codeRabbitReview.sh`
shares `threads`, `reply`, `resolve` and `open` with sunshine's `scripts/copilotReview.sh`. An
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
   round. When CodeRabbit's status says it waits to be asked, as its free plan can below ten
   stars, the wait asks it with an `@coderabbitai review` comment, and does the same once a rate
   limit runs out. The free plan allows ten reviews an hour, shared by every session, so never ask
   by hand: an ask beside the wait's costs a review. A round with nothing to say ends `Review
   completed` and leaves no review at all.
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
