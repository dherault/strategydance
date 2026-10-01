# CLAUDE.md

Guidance for Claude Code when working in this repository.

**Every change to a tracked file ships without asking.** It is made in its own worktree,
committed granularly as each piece passes CI's checks, pushed, opened as a pull request into
`dev` and taken through the Copilot review loop, until all that is left for a human is the
merge. That is the person's standing request in every session, so never ask whether to commit,
push, open the pull request or address the review. [Workflow](#workflow) says how.

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
- `packages/strategydance-database` — the Firebase Data Connect service: the Postgres schema,
  one connector per caller, and the SDK generated from them. Import it as
  `strategydance-database/web`, or `strategydance-database/web/react` for the TanStack Query
  hooks, and the backend as `strategydance-database/backend`. See below
- `packages/strategydance-backend` — a Bun and Express server on Cloud Run, for what the
  browser cannot do for itself because it needs a secret or the server's word. Today that is
  inviting people, which emails them. See below
- `packages/strategydance-design-system` — the component library: shadcn on Radix, and on Base
  UI where shadcn is, as its combobox is, Tailwind CSS v4, documented in Storybook. Its rich text
  editor is [BlockNote](https://www.blocknotejs.org)'s, in its shadcn flavour, and what it writes is
  drawn by `RichText` without it. It imports itself by its package name,
  `strategydance-design-system/*` mapped to its `src/`, the alias shadcn writes with, so a
  component resolves the same when another package reads it as source. Its tokens and components
  are ported from the Strategy Dance Design System project in Claude Design and keep that
  project's props, so what a design uses maps onto code. Another package imports
  `strategydance-design-system/components/ui/Button` and `strategydance-design-system/index.css`
- `packages/strategydance-translations` — the Gemini-backed CLI that fills the locale
  catalogues. Node-only: never import it from the frontend
- `packages/strategydance-emails` — the transactional emails, as
  [React Email](https://react.email) templates. Node-only: the backend renders them. See below
- `documents/`, at the root — documents written for people rather than for the build, in
  Markdown and nothing else. `.gitignore` hides any other file put there, so it never reaches a
  commit. A commit there is scoped `[documents]`
- [oxlint](https://oxc.rs) for linting and oxfmt, from the same project, for formatting, configured
  in `.oxlintrc.json` and `.oxfmtrc.json`. See [Linting and formatting](#linting-and-formatting)
- `tsc` for typechecking. In `packages/strategydance-web`, imports go through `~` aliases: `~components`,
  `~contexts`, `~data`, `~hooks`, `~utils`, `~constants`, `~types`, declared in its
  `tsconfig.json` and mirrored in `vite.config.ts`. The backend has its own, in its
  `tsconfig.json`, which Bun reads at runtime. Cross-package imports use the package name
- `bunfig.toml` sets a 7-day install cooldown: a version must have been published for a week
  before it can be installed

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Web dev server on http://localhost:5173. Wants `dev:emulators` beside it, and `dev:backend` for anything that calls the backend |
| `bun run dev:emulators` | Auth, Data Connect and Storage emulators, with a UI on http://localhost:4000 |
| `bun run dev:backend` | The backend on http://localhost:3003, against the emulators |
| `bun run dev:emails` | React Email's preview server on the email templates, on http://localhost:3000 |
| `bun run grant:administrator <email>` | Makes an account that has signed in once an administrator of Strategy Dance, in the emulators only. Nothing grants it in production |
| `bun run storybook` | The design system's Storybook on http://localhost:6006 |
| `bun run build` | Typechecks and builds the design system's Storybook, then the web package to static files |
| `bun run preview` | Builds against the emulators, then serves `dist/client` through the Hosting emulator on http://localhost:5050 |
| `bun run lint` | oxlint across the repo, then oxfmt's check. A warning fails it, and so does an unformatted file |
| `bun run lint:fix` / `format` | Applies oxlint's safe fixes, then formats; or only formats |
| `bun run typecheck` | `tsc` across the packages |
| `bun run test` | `bun test` across the packages, each file in a fresh global so a `mock.module` stays in the file that made it |
| `bun run generate:database` | Regenerates the Data Connect SDK. `postinstall` already does this |
| `bun run translate` | Fills the locale catalogues from the `defaultMessage`s. Run it when a message changes |
| `bun run ship` | Opens the release pull request, from `dev` to `main`, unless one is already open |
| `bun run review <command>` | The GitHub calls of the Copilot review loop: `count`, `wait`, `body`, `threads`, `reply`, `resolve` and `open`. See [Copilot review loop](#copilot-review-loop) |
| `bun run deploy:backend` | Builds the root `Dockerfile` on Cloud Run and deploys `strategydance-backend`. Every push to `main` runs it too |
| `bun run kill` / `kill:backend` / `kill:emulators` | Kills the dev server, the backend, or the emulators, found by the ports they listen on. A browser connected to one of those ports is left alone |

**CI's definition of green** is the pull request check: `bun run lint && bun run typecheck &&
bun run test && bun run build` from the root. Run those four before every commit, since the
husky `pre-commit` hook only lints.

**The `deploy:*` scripts are run by humans only.** A merge into `main` deploys the release by
itself, and a migration that stops it waits for a human to read its SQL, as
[What a merge into `main` deploys](#what-a-merge-into-main-deploys) says.

Two things are generated and never edited by hand.
`packages/strategydance-web/src/routeTree.gen.ts` is written by the TanStack Router plugin on
dev and build, and is committed because `tsc` needs it.
`packages/strategydance-database/generated/` is written by the Firebase CLI on `postinstall`,
and is **not** committed: generating it needs neither credentials nor a network, so a clone
produces its own. That is why `firebase-tools` is a devDependency.

### Linting and formatting

oxlint lints and oxfmt formats, from one root `.oxlintrc.json` and one root `.oxfmtrc.json`, as
in sunshine. `bun run lint` checks both, so an unformatted file fails CI and the husky
`pre-commit` hook as a lint error does, and so do a warning and a disable directive that no
longer suppresses anything. `bun run lint:fix` applies oxlint's safe fixes and then formats, but
stops before formatting when an error it cannot fix remains; `bun run format` formats on its
own. A PostToolUse hook does the same to every file Claude Code edits, `oxlint --fix` on a
`.ts`/`.tsx` under `packages/` and then oxfmt on anything in the repo it formats. A Stop hook
typechecks every package when a turn ends, and VS Code formats on save through the oxc
extension.

- **Keep it to one config.** A nested `.oxlintrc.json` replaces the root one for its directory
  rather than extending it, so it would silently drop every rule. A package-specific rule goes
  in the root config's `overrides`
- **The formatter owns layout**: two spaces, single quotes, no semicolons, one JSX prop per
  line, 120 columns. The order of the classes in a `className` is still kept by hand: oxfmt's
  Tailwind sorting would replace the semantic order this code follows with Tailwind's official
  one
- **So is import order.** Imports sort into the groups `.oxfmtrc.json` lists, one per alias; an
  import no group matches sorts into `rest`, after all of them, so a new `~` alias needs a group
  of its own there. A `/// <reference>` directive moves with the import below it, and
  TypeScript ignores one that is not at the top of the file: keep it above the import that
  sorts first
- **Markdown and HTML are not formatted**, nor are the files a generator writes
  (`routeTree.gen.ts`, the Data Connect SDK, the translated catalogues, the translation lock),
  whose next run would rewrite them anyway. The schema and the connectors are formatted, and
  generate the same SDK
- **An unused import is an error that `--fix` does not remove**: oxlint files that fix as
  dangerous. An import written before the code that uses it survives the edit hook and is only
  reported
- A suppression is `// oxlint-disable-next-line <rule>` under oxlint's rule names
  (`react/exhaustive-deps`, not `react-hooks/exhaustive-deps`), and it covers the line below it
  as formatted, which is not always where it was written once the formatter wraps a long
  statement

## Frontend conventions

### No manual memoization

The React compiler is on, so it memoizes components and values itself. Never write
`useCallback` or `useMemo`: a hand-written memo is now noise the compiler has to see past, and
the repo has none.

`useRef` is not a memo and stays. `useState`'s lazy initializer stays.

`.oxlintrc.json` turns on the compiler's own diagnostics as `react/*` rules: `purity`,
`immutability`, `memo-dependencies`, `set-state-in-render`, `no-deriving-state-in-effects` and
the rest. They report what the compiler would refuse to optimize, which is worth knowing at
lint time rather than as quietly missing memoization.

The one friction is oxlint's `react-hooks(exhaustive-deps)`, which reads the source rather than
the compiler's output and so cannot tell that a plain function in a component body is stable.
It fires when such a function appears in a dependency array. Restructure rather than reaching
for `useCallback`: define the function inside the effect that uses it, or have the effect call
the underlying stable thing (a mutation from a hook, a setter) directly.

### One concern, one file

A hook, a context, a provider, a waiter and a bouncer are five kinds of thing, and each gets its
own file. Never two in one module, even when one is three lines long.

| Kind | Where | Named |
| --- | --- | --- |
| Context | `src/contexts/`, flat | `XContext.ts`, named for its domain: `ChatHomeContext`, not `HomeContext`. The prefix is what says which domain a generic name belongs to |
| Provider | `src/components/<domain>/` | `_XProvider.tsx`; the leading underscore sorts it to the bottom of the listing |
| Hook | `src/hooks/<domain>/` | `useX.ts`, default-exported, one per file, under the same domain as its provider |
| Waiter | `src/components/<domain>/` | `XWait.tsx` — renders `<Loading />` until its data lands, then passes `children` through. Gates, never decides |
| Bouncer | `src/components/<domain>/` | `XBouncer.tsx` — turns a resolved verdict into a screen or a redirect, or passes `children` through. Decides, never waits |

The order between a waiter and a bouncer is load-bearing: **a waiter sits above the bouncer that
reads the same data**, or the bouncer judges a value that has not loaded. One concern per file is
what makes that order auditable in a diff.

`IntlMessagesRegistration` is a waiter under another name, parameterized by the catalogues it
waits on.

### Where a provider is mounted

Providers go in `getRouter`'s `Wrap` in `src/router.tsx`. Waiters and bouncers do not.

`Wrap` sits above the document shell, so anything mounted there that withholds its children
replaces the whole document, `<Scripts />` included. The page then has no client bundle to boot
from and keeps whatever the server rendered, forever. Anything that gates belongs inside the
document, in `__root.tsx`'s `component` or below it.

### UI comes from the design system

The frontend has no shadcn setup of its own. Buttons, inputs, selects, alerts, the logo and the
rest come from `strategydance-design-system`, and a primitive it lacks is added there, with a
story, rather than to `src/components/ui/`. That folder holds only the frontend's glue around
them: `FormField` for react-hook-form, `TextDivider`.

Strings stay in the frontend's catalogues. A design-system component that names itself in
English, like the spinner's "Loading", gets its label from `react-intl` where the frontend uses
it: `~components/common/Spinner` is the design system's spinner with that label. The one
exception is BlockNote's menus, dozens of strings that BlockNote translates into every locale the
app speaks: `RichTextEditor` takes the app's `locale` for them, and only its placeholder and its
heading's name come from a catalogue.

shadcn's combobox is Base UI's, so the `MultiSelect` runs on `@base-ui/react` beside Radix, and
its popup is a stranger to Radix's layers. A modal Radix dialog traps focus, disables pointer
events and hides from assistive technology everything outside itself, and dismisses on any Escape
that reaches the document. The `MultiSelect` portals its list into the dialog around its trigger
and claims Escape while the list is open. A Base UI popup added later needs both, and a story
inside a `Dialog` to show it works there. BlockNote's shadcn menus are Base UI's too: they portal
into the editor, and `RichTextEditor` claims Escape while one is open and floats its toolbar over
the selection on touch screens too, since BlockNote's mobile toolbar portals to the body.

### Static files

`packages/strategydance-web/public/` is served as-is from the site root, unhashed. Images go
under `public/assets/images/`, so the logos are at `/assets/images/logo/logo-black.svg` and the
like, for anything that needs a URL rather than a component, like an email. Inside the app the
mark is still the design system's `Logo`.

Vite writes its hashed bundles flat into `/assets/`, and `firebase.json` caches them for a year
as immutable. That rule's source is `/assets/*`, one star, so it stops at that folder: an image
under `/assets/images/` keeps its name when its content changes, and falls to the one-day image
rule instead. Widening it to `/assets/**` would pin an edited logo in browsers for a year.

### Firebase

`src/data/firebase.ts` initializes everything: Auth, App Check, Data Connect, Storage and
Performance. Nothing else calls `initializeApp`.

**Guard anything that touches a browser global.** SPA mode prerenders the document shell in
Node at build time, and the route tree really is rendered there, so every module a route
imports is evaluated with no `window`. App Check reads `self`, Performance reads `document`,
and an emulator connect opens a socket no build should open. That is what the `isBrowser`
constant in that file is for, and why `appCheck` is nullable.

The config is hardcoded and public by design. An apiKey identifies the project rather than
authorizing anything; the guards are App Check, `storage.rules`, and the `@auth` level on
every Data Connect operation.

Development always talks to the emulators, so `bun run dev` wants `bun run dev:emulators`
beside it. So does `bun run preview`, which starts its own: its bundle is a production build,
so the `DEV` check cannot carry it, and `VITE_USE_FIREBASE_EMULATORS=true` is what does. A
local preview that signs people into the real project and writes real rows would be a trap
rather than a preview.

**The Hosting preview channel on each pull request is the exception, and it writes real
data.** There is one Firebase project, so a preview build talks to it: signing in on a
preview URL creates a real account, and anything it stores is a real row. Use a preview to
look at what renders, not to exercise sign-up. Isolating it means a second project with its
own Cloud SQL instance, which is a deliberate decision nobody has taken yet. The App Check debug token prints to the console on first run and has to be
registered in the Firebase console before a browser can reach the real project; the emulators
do not enforce App Check, so the usual loop never needs it.

**App Check enforcement is a console setting, not a code one.** Initializing it here attaches
a token; nothing rejects a request without one until enforcement is switched on per service.
That matters most for the sign-in screen's `@auth(level: PUBLIC)` email lookup, which
enumerates registered addresses to any direct caller until it is. Switch it on for Data
Connect and Storage before the project is reachable from the internet.

**Storage lets another origin read a file only as `storage.cors.json` allows.** A browser shows
an `<img>` from Storage without it, but reading the bytes, as the build in public page does to
draw a card as a PNG, takes the bucket's CORS rule. It is a setting on the bucket, which no
deploy sends: after changing the file, run `gcloud storage buckets update
gs://strategydance.firebasestorage.app --cors-file=storage.cors.json` as an account that may
change the bucket. A preview channel's origin is not listed, so an export there draws initials
where the pictures were. The Storage emulator applies no rule, so development never needs it.

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
- An operation takes no `@check` of its own. A check that reads only variables sits on a field
  of the first, redacted step, where `@check` is repeatable
- A mutation writes each row once. Data Connect runs the first write to a row and silently skips
  any later one in the same mutation, aliased or not: an `organization_update` row lock followed
  by another `organization_update`, or by `organization_delete`, changes nothing. When the row a
  mutation locks is the row it writes, the write itself is the lock, and the checks follow it
- Every operation carries an `@auth` level. `USER` keys off `auth.uid`, so a query cannot be
  shaped to read somebody else's row. The one `PUBLIC` operation is the sign-in screen's email
  lookup, and its comment says what that costs
- An operation that finds its row by `auth.token.email` rather than `auth.uid`, as the
  invitation ones do, is `USER_EMAIL_VERIFIED`. A password sign-up can name any address nobody
  has claimed yet, so the address proves nothing until it is verified. The claim lives in the ID
  token, so a tab that just saw the address confirmed mints a new one, as `refetch` on
  `AuthenticationContext` does. Locally the Auth emulator prints the confirmation link in its
  log rather than sending it
- Server values over variables wherever the server knows better: `id_expr: "auth.uid"`,
  `email_expr: "auth.token.email"`, `updatedAt_expr: "request.time"`. A client that fills these
  in can write a row as somebody else
- `Locale` is declared in both `schema.gql` and strategydance-core, because neither side can
  read the other. `packages/strategydance-database/schema.test.ts` is what fails when they
  stop agreeing. Add a locale to both
- Every other enum, `CompanyAspect` among them, lives in `schema.gql` alone. The generated SDK
  exports each as values in the schema's order, and the frontend imports them from
  `strategydance-database/web`
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

The build in public page counts a member's streak from `ActivityDay` rows: one per member,
organization and day on which they changed their own Today data, their top priority, a task
list or task, their checklist or their log. The day is the one the change was made on, never
the day it was about, and `RecordActivity` holds it to the caller's today. The mutations that
make those changes do not write the row themselves, since each would need a `$date` it has no
other use for, a breaking connector change: the web app calls `recordActivity` once one goes
through, from the `change` helpers of `useTaskLists`, `useTasks` and `useChecklist` and from the
components that set a priority or write the log. A new way to change Today data calls it too, or
the days it is used on go uncounted.

### Routing

The authenticated area is the pathless `src/routes/_authenticated.tsx`, so its pages share the
root with the public ones: `/today` beside `/legal`. A page there takes a name no public page
has. Two static routes at one path fail the build ("Conflicting configuration paths"), but a
static route outranks a dynamic segment silently, so a `$param` never sits at the root: the
aspects are under `/aspects/`, where the public `/legal` cannot hide the Legal aspect.

No path prefix marks a page as authenticated, so code that needs to know asks the question it
means: `isAuthenticationPath` in `~utils/authentication` says whether a path is a sign-in
screen, which is all `parseRedirectPath` and `AuthenticationBouncer` need.

An address nothing matches, and a `notFound()` any page throws, render `NotFound` full screen:
it is the root's `notFoundComponent`, and no other route sets one. The root stays mounted as the
boundary and shows it in its outlet, so its strings live in `global`, the one catalogue the root
registers. A route that sets a `notFoundComponent` of its own catches its pages before the root
does.

The area used to live under `/-/`, and invitation emails sent then still link there, so
`firebase.json` redirects `/-/<path>` to `/<path>` with a 301. It is a `regex` rather than a
`:path*` source because the Hosting emulator's `:path*` matches one segment only, and
`/-/invitation/<id>` has two. Its capture has to start with a letter or a digit: `/-//evil.example`
would otherwise answer `Location: //evil.example`, which a browser reads as another host.

A `validateSearch` that leaves a key out does not remove it. TanStack lays what it returns over
the raw query, so `useSearch()` still reads the raw value: a key that fails validation has to be
overwritten with `undefined`. The sign-in screen's `redirect` is the case that matters, since
following an unchecked one is how a link sends somebody elsewhere.

`<Navigate>` navigates again whenever its props change. Fed anything that follows the location,
it redirects to its own redirect: navigate from an effect on the verdict instead, reading the
location off the router inside it, as `AuthenticationBouncer` does.

### Internationalization

- User-facing strings go in `src/data/intl/messages/*.ts`, never hardcoded in a component. Ids
  are dotted `<messageType>.<path>` and unique across every message file
- A new message type needs its source module, an entry in `MESSAGE_TYPES`, and an
  `IntlMessagesRegistration` on the route that needs it
- **Never edit `src/data/intl/messages-translated/` by hand.** Those files are written by
  `bun run translate` and nothing else
- **Run `bun run translate` whenever a message changes**, and commit the result. It is
  incremental: `translations.lock.json` records a hash per id, so only genuinely new or edited
  strings reach Gemini and a no-op run costs nothing. Leaving it for somebody else means the
  branch ships six locales that silently render English. Commit `translations.lock.json` with
  the locale files it vouches for; deleting the lock, a locale file, or one entry forces a
  retranslation
- **Never write an em dash in a `defaultMessage` or a `description`.** Use a full stop, a comma
  or a colon. It reads as machine-written, and all six translated locales inherit it

## Backend conventions

`packages/strategydance-backend` follows sunshine's backend, trimmed: one router per resource
in `routes/`, the Express middleware in `middleware/`, what a route does in `domain/`, helpers
in `utils/`, one concern per file.

- Every answer is the `ApiResponse` envelope from strategydance-core, and every refusal goes
  through `respondError` with an `ERROR_CODE_*` from there, so the web app reads one shape. It
  calls the backend through `requestApi` in `~data/api`, which throws an `ApiError`
- No body parser is applied app wide. A route parses its own, then runs `appCheckMiddleware`,
  `authenticationMiddleware` and `validateMiddleware`, and reads its caller with `readViewer`.
  A route taking a file parses last instead, after `organizationAdministratorMiddleware` or
  whatever says the caller may send it, so nobody else gets megabytes buffered
- Credentials are Application Default Credentials: nothing is stored, and on Cloud Run the
  service's own account needs `roles/firebasedataconnect.dataAdmin`, which runs reads and writes
  but cannot change the schema, and `roles/storage.objectAdmin` on the bucket. In development
  `dev:backend` points Auth, Data Connect and Storage at the emulators, and App Check is skipped,
  as the emulators skip it
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
- A push to `main` deploys the backend with the rest of the release, by running
  `bun run deploy:backend`, as [What a merge into `main` deploys](#what-a-merge-into-main-deploys)
  says. `.gcloudignore` leaves out `gha-creds-*.json`, the credentials file the job writes into
  the workspace, which the upload would otherwise carry into the image
- Organizations' logos and banners are the backend's to write, since only an administrator may
  and a Storage rule cannot read who administers what. It stores each under a fresh name with
  its own download token, writes that URL to the row, and deletes the file the row pointed at
  before. `storage.rules` grants clients nothing under `organizations/`
- Every email goes out through `sendEmails` in `domain/email/`, over Resend's batch endpoint, from
  `david@strategydance.com`. That domain has to stay verified in Resend, and the mailbox has to
  receive, since the welcome email asks for a reply. The key is the `resend-api-key` secret, read
  from Secret Manager through `retrieveSecret` in `utils/`, which caches it for the life of the
  process: the service's account needs Secret Manager's accessor role on it, and a rotated key
  takes effect with the next revision
- Only production sends. Anywhere else `sendEmails` writes the HTML to the OS temp directory and
  logs its path, and `sendOrganizationInvitationEmails` also logs each invitation's link, which
  is how an invitation gets accepted locally

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

## Workflow

**This section is the person's own request, standing in every session.** Any task that changes a
tracked file, however small, goes worktree → granular commits → push → pull request into `dev` →
Copilot review loop → handed to a human, in one go, without stopping to ask. "Should I commit?",
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
commands, and `scripts/copilotReview.sh` and `scripts/ship.sh` are the same file in both. An
improvement to one goes to the other.

### Work in a worktree

Create the worktree **before the first edit**, and do every edit, test, commit and push in it.
Never edit, switch branches or commit in the main checkout, unless the person asks for a
checkout there (below): other sessions are running in it at the same time, the person's dev
servers serve it, and a `git switch` there changes the ground under all of them.

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
  rather than committing it there: `git -C <main checkout> diff HEAD | git apply` from the
  worktree, plus any untracked files by hand. Leave the original for the person to discard
- The person's stack usually holds ports 5173 and 3003 from the main checkout, and other
  sessions run worktree servers of their own. To look at the worktree's frontend, start it on
  the first port from 5174 that nothing listens on (`lsof -nP -iTCP:<port> -sTCP:LISTEN` prints
  nothing): `bunx vite --port <port> --strictPort` from its `packages/strategydance-web`. The
  development backend accepts any origin. Aim a browser or a script at that port and no other,
  since one left on a port another session took tests that session's branch without a word
- Keep the worktree until the pull request merges, since the review rounds are fixed in it, then
  `git worktree remove .claude/worktrees/<branch>`

**A checkout in the main checkout, when the person asks for one.** This is the one exception to
the rule above, typically so they can try a branch on the stack they already run there ("check
it out", "put it on my checkout"). Only their request counts, never your own convenience:

- The main checkout must be clean first (`git -C <main checkout> status --porcelain` prints
  nothing). When it is not, say what is there and stop. Never stash it, since the stash stack is
  shared by every worktree and session, and never discard it
- Note the branch it is on before the switch and tell the person, so it can be put back. Put it
  back only when they ask
- Check the branch out **detached**: `git -C <main checkout> switch --detach <branch>`. A plain
  `git switch <branch>` fails with "already used by worktree", because git lets a branch be
  checked out in one place at a time, and the worktree keeps it on purpose: the review rounds
  are still committed there. After pushing a round's fixes, run the same command again to bring
  the main checkout along, as long as it is still clean and still on the branch's previous
  commit
- When the person wants the branch itself there, to commit on it themselves, the worktree lets
  go first (`git switch --detach` inside it), then `git -C <main checkout> switch <branch>`. The
  branch's remaining work, review rounds included, then happens in the main checkout, where they
  put it. Never use `--ignore-other-worktrees`: with one branch checked out twice, a commit in
  either leaves the other's files behind, and the stale one then shows that commit reversed as
  staged changes
- The switch moves the code, not what is built from it. Run `bun install --frozen-lockfile`
  there when the branch changed dependencies or the database package, whose SDK its postinstall
  regenerates: an install that is not frozen can rewrite `bun.lock`, which leaves the checkout
  dirty and stops the next refresh
- The Data Connect emulator watches the main checkout's `schema.gql` and connectors, and
  migrates the moment they change on disk, dropping every table it cannot migrate additively.
  Before a switch that changes the database package, check whether it runs (`lsof -nP -iTCP:9399
  -sTCP:LISTEN`). When it does, say so and let the person stop it, or export its data first
  (`bunx firebase emulators:export ./firebase-export-<date>-backup`)

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
staged paths: `[web]`, `[backend]`, `[core]`, `[database]`, `[design-system]`, `[translations]`,
`[emails]`, `[documents]`, or `[root]` when the change spans more than one. **Write the message
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

Never open a pull request as a draft. The `dev` ruleset has Copilot skip drafts, so no review
would ever arrive and the wait in the loop below would never end.

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

### Copilot review loop

1. **Never request a review.** The repository requests one automatically, on the pull request
   and on every push to it. Requesting by hand races that: `gh pr edit <number> --add-reviewer
   @copilot` exits 0 and requests nothing anyway, because resolving `@copilot` needs a
   `read:project` scope this token lacks and gh swallows the partial GraphQL error, and the
   `requestReviews` mutation that does work only adds a duplicate.

   Wait for the review to land instead. `bun run review` (`scripts/copilotReview.sh`) holds
   every GitHub call of this loop: it has to be a script, because a session inside a worktree
   refuses a `gh` call nested in `$(…)` or in a shell loop, which a wait is. What it counts is
   reviews *by Copilot with a non-empty body*; the script says why each part of that matters.

   ```sh
   bun run review count <number>             # the baseline, read before the push that asks for a review
   bun run review wait <number> <baseline>   # returns once the count passes it
   ```

   The baseline is 0 for a pull request just opened. Never read it after `gh pr create`: the
   opening review may already be in it, and the wait then holds out for one that never comes.
   **Wait in the foreground, inside the same turn**. Nothing else is waiting on you, and a turn
   that ends on "I will pick it up when it lands" leaves the person to come back and tell you it
   has. A review takes a few minutes. The wait gives up after nine minutes, inside the shell's
   ten-minute cap, with exit status 75 and a message: run the same command again, as many times
   as it takes.
2. Wait for CI (`gh pr checks <number> --watch`) and fix whatever fails. Its job, `ci` in
   `.github/workflows/check-pull-request.yml`, is a required check on `main`.
3. Answer every Copilot comment, either with an edit that addresses it or a reply explaining why
   it does not apply. Never ignore one, and never resolve one without replying first.

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

   Read the review's body too (`bun run review body <number>`), not only its threads. Copilot
   lists findings there under *Previously missed*, against lines the round's diff did not touch,
   and those have no thread to reply on. Handle them the same way and answer them in one pull
   request comment (`gh pr comment <number>`).

   All of this happens **before the push**, so the next automatic review reads the replies along
   with the diff rather than re-raising what has already been answered. Citing a commit that
   exists only locally is fine: it will be pushed before anybody follows it.
4. Commit the fixes, granularly, without pushing yet.
5. Read the count (`bun run review count <number>`), then push behind the open check (above),
   which is what asks for the next round. That count is the baseline the next wait has to pass.
   Do not push while a review is in flight: land the round you have, answer it, then push its
   fixes as one batch. Pushing mid-round gets you overlapping reviews of different heads, and
   findings against code you have already replaced.
6. Repeat from step 1, with the count from before this push as the one to pass, until a round
   comes back with nothing but nitpicks or praise. Step 1, not step 2: CI can finish before the
   new review exists, and answering the threads at that point answers the old round again.

### Hand the pull request to a human

Never merge a pull request: that is a human decision, taken on GitHub after a human approval.
Once CI is green and review is clean, say so, link the pull request and stop there.

Humans merge with a merge commit, not a squash, and the repository allows nothing else: the
granular commits are the point, and squashing collapses them into one.

### Ship `dev` to `main`

Taking `dev` to `main` is a release, and a human's call like any other merge, since it deploys
everything, the database included (see below). `bun run ship` (`scripts/ship.sh`) opens the
release pull request, titled "Ship dev to main", with the release's commits as its body. It is
idempotent, reporting the open one rather than failing, since one release pull request stays
open across several merges into `dev`, and it refuses to run while local `dev` has unpushed
commits the release would leave behind. A human merges it. Nothing pushes to `main` directly:
its ruleset accepts only a pull request.

### What a merge into `main` deploys

Every push to `main` runs `.github/workflows/deploy-merge.yml`, which deploys the release in the
order it needs: Data Connect, the backend, the Storage rules, then the frontend. Each step waits
on the one before it, so a release that stops partway stops before anything that relies on what
failed.

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

A machine that migrates the database by hand needs `firebase experiments:disable
fdcapimigration` run on it once. firebase-tools turns that experiment on by default, and it
sends the SQL to a Data Connect endpoint that answers this service with a 404. The workflow
turns it off on every run.

Pull requests still deploy a Hosting preview, with the one key the repository holds, which
`firebase-hosting-pull-request.yml` explains. `delete-preview-channel.yml` deletes a pull
request's channel when it closes, since Hosting caps the channels a site holds and a preview past
the cap fails with a 429. Run by hand from the Actions tab, it deletes every channel but `live`,
which is the way out once the quota is full. Both triggers run the copy on `main`, whatever a pull
request's base: `pull_request_target` always runs the default branch's workflow, and GitHub
offers a workflow to run by hand only once the default branch holds it. A change to it takes
effect with the release, not with its merge into `dev`.
