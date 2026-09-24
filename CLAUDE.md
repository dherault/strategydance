# CLAUDE.md

Guidance for Claude Code when working in this repository.

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
  hooks. See below
- `packages/strategydance-design-system` — the component library: shadcn on Radix, Tailwind
  CSS v4, documented in Storybook. It imports itself by its package name,
  `strategydance-design-system/*` mapped to its `src/`, the alias shadcn writes with, so a
  component resolves the same when another package reads it as source. Its tokens and components
  are ported from the Strategy Dance Design System project in Claude Design and keep that
  project's props, so what a design uses maps onto code. Another package imports
  `strategydance-design-system/components/ui/Button` and `strategydance-design-system/index.css`
- `packages/strategydance-translations` — the Gemini-backed CLI that fills the locale
  catalogues. Node-only: never import it from the frontend
- [oxlint](https://oxc.rs) for linting, configured in `.oxlintrc.json`
- `tsc` for typechecking. In `packages/strategydance-web`, imports go through `~` aliases: `~components`,
  `~contexts`, `~data`, `~hooks`, `~utils`, `~constants`, `~types`, declared in its
  `tsconfig.json` and mirrored in `vite.config.ts`. Cross-package imports use the package name
- `bunfig.toml` sets a 7-day install cooldown: a version must have been published for a week
  before it can be installed

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Web dev server on http://localhost:5173. Wants `dev:emulators` beside it |
| `bun run dev:emulators` | Auth, Data Connect and Storage emulators, with a UI on http://localhost:4000 |
| `bun run storybook` | The design system's Storybook on http://localhost:6006 |
| `bun run build` | Typechecks and builds the design system's Storybook, then the web package to static files |
| `bun run preview` | Builds against the emulators, then serves `dist/client` through the Hosting emulator on http://localhost:5050 |
| `bun run lint` | oxlint across the repo |
| `bun run typecheck` | `tsc` across the packages |
| `bun run test` | `bun test` across the packages |
| `bun run generate:database` | Regenerates the Data Connect SDK. `postinstall` already does this |
| `bun run translate` | Fills the locale catalogues from the `defaultMessage`s. Run it when a message changes |
| `bun run ship` | Opens the release pull request, from `dev` to `main`, unless one is already open |
| `bun run kill` / `kill:emulators` | Frees the dev server port, or the four emulator ports |

Run lint, typecheck and build before every commit — the husky pre-commit hook only lints.

Two things are generated and never edited by hand.
`packages/strategydance-web/src/routeTree.gen.ts` is written by the TanStack Router plugin on
dev and build, and is committed because `tsc` needs it.
`packages/strategydance-database/generated/` is written by the Firebase CLI on `postinstall`,
and is **not** committed: generating it needs neither credentials nor a network, so a clone
produces its own. That is why `firebase-tools` is a devDependency.

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
it: `~components/common/Spinner` is the design system's spinner with that label.

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

### The database

Schema and operations live in `packages/strategydance-database`, and the generated SDK is the
only way the app talks to them.

- One connector per caller. `strategydance-web-connector` is the browser's; a backend one will
  sit beside it rather than widening this one, because `@auth` levels differ by who is asking
  and the web bundle should not carry operations only a server may call
- Every operation carries an `@auth` level. `USER` keys off `auth.uid`, so a query cannot be
  shaped to read somebody else's row. The one `PUBLIC` operation is the sign-in screen's email
  lookup, and its comment says what that costs
- Server values over variables wherever the server knows better: `id_expr: "auth.uid"`,
  `email_expr: "auth.token.email"`, `updatedAt_expr: "request.time"`. A client that fills these
  in can write a row as somebody else
- `Locale` is declared in both `schema.gql` and strategydance-core, because neither side can
  read the other. `packages/strategydance-database/schema.test.ts` is what fails when they
  stop agreeing. Add a locale to both
- Every other enum, `CompanyAspect` among them, lives in `schema.gql` alone. The generated SDK
  exports each as values in the schema's order, and the frontend imports them from
  `strategydance-database/web`
- A schema change reaches production only through `bun run deploy:database`. Merge it after,
  not before, or the live frontend queries fields its database does not have yet

### Routing

The authenticated area is `src/routes/[-].tsx`, not `-.tsx`. The router generator skips any
file whose name starts with `routeFileIgnorePrefix`, which defaults to `-`; brackets are its
own escape syntax and unwrap to a literal. Do not change that prefix to work around this: it
would re-enable every `-`-prefixed excluded file in the tree.

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

## Workflow

### Granular commits

One logical change per commit, each self-contained and passing lint, typecheck and build on
its own. A dependency bump, a refactor and a feature are three commits, not one.

Write subjects in the imperative mood, saying what the change does rather than which files it
touches.

### Branch off `dev`

`dev` is the integration branch: every pull request starts from it and goes back into it.
Never commit to `dev` or `main` directly, and never leave a branch with commits but no pull
request. Work is finished when its pull request is reviewed, green and waiting for a human —
not when the code is written.

```sh
git switch dev && git pull --ff-only
git switch -c <branch>
# commit, then:
gh pr create --base dev
```

`--base dev` is not optional: the repository's default base branch is `main`.

### Copilot review loop

1. **Never request a review.** The repository requests one automatically, on the pull request
   and on every push to it. Requesting by hand races that: `gh pr edit <number>
   --add-reviewer @copilot` exits 0 and requests nothing anyway, because resolving `@copilot`
   needs a `read:project` scope this token lacks and gh swallows the partial GraphQL error,
   and the `requestReviews` mutation that does work only adds a duplicate.

   Wait for the review to land instead. Count reviews *by Copilot with a non-empty body*:
   every reply posted to a thread creates a review record with an empty one, so a bare count
   climbs without a review having happened.

   ```sh
   gh api repos/dherault/strategydance/pulls/<number>/reviews \
     --jq '[.[] | select(.user.login | test("copilot")) | select(.body | length > 0)] | length'
   ```
2. Wait for CI and fix whatever fails.
3. Answer every Copilot comment, either with an edit that addresses it or a reply explaining
   why it does not apply. Never ignore one, and never resolve one without replying first.

   Then resolve the thread, so the next round shows only what is still open. `gh` has no
   command for it, so it is GraphQL:

   ```sh
   # Thread ids, with the first comment of each so you can tell them apart
   gh api graphql -f query='query($owner:String!,$name:String!,$pr:Int!){repository(owner:$owner,name:$name){pullRequest(number:$pr){reviewThreads(first:100){nodes{id isResolved comments(first:1){nodes{path body}}}}}}}'      -f owner=dherault -f name=strategydance -F pr=<number>

   gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=<thread id>
   ```

   Reply first, resolve second: resolving hides the thread, and a reviewer who cannot see the
   answer reads it as the comment having been waved away.

   All of this happens **before the push**, so the next automatic review reads the replies
   along with the diff rather than re-raising what has already been answered. Citing a commit
   that exists only locally is fine: it will be pushed before anybody follows it.
4. Commit the fixes, granularly, without pushing yet.
5. Push, which is what asks for the next round. Do not push while a review is in flight:
   land the round you have, answer it, then push its fixes as one batch. Pushing mid-round
   gets you overlapping reviews of different heads, and findings against code you have
   already replaced.
6. Repeat from step 2 until a round comes back with nothing but nitpicks or praise.

### Hand the pull request to a human

Never merge a pull request — that is a human decision, taken on GitHub after a human
approval. Once CI is green and review is clean, say so, link the pull request and stop there.

Humans merge with a merge commit, not a squash: the granular commits are the point, and
squashing collapses them into one.

### Ship `dev` to `main`

`bun run ship` opens the release pull request, the one that takes everything sitting on `dev`
to `main`. It is the only pull request nobody writes by hand: its title never varies and its
body is the list of commits `main` has not seen yet, merges dropped, since a merge names the
branch work arrived on and the commits under it say what the release does. A range holding
nothing but merges lists those instead, rather than nothing.

Running it twice is safe. `dev` is long lived, so the release pull request stays open while
further work merges into it, and a second run prints its URL instead of failing.

It compares `origin/dev` to `origin/main` rather than the local branches, since those are what
GitHub will compare, and it refuses outright when the local `dev` is ahead of its remote: a
commit that has not been pushed is a commit the pull request would leave behind. Pushing it is
your call, not the script's.

Merging it is a human decision like any other.
