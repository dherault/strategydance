# strategydance-web

The app's conventions, beside the root `CLAUDE.md`. Imports go through the `~` aliases
(`~components`, `~contexts`, `~data`, `~hooks`, `~utils`, `~constants`, `~types`), declared in
`tsconfig.json` and mirrored in `vite.config.ts`.

## One concern, one file

| Kind | Where | What it does |
| --- | --- | --- |
| Context | `src/contexts/XContext.ts`, flat | Named for its domain: `ConversationDockContext`, not `DockContext` |
| Provider | `src/components/<domain>/_XProvider.tsx` | The underscore sorts it last in its folder |
| Hook | `src/hooks/<domain>/useX.ts` | One per file, default-exported |
| Waiter | `src/components/<domain>/XWait.tsx` | Renders `<Loading />` until its data lands. Gates, never decides |
| Bouncer | `src/components/<domain>/XBouncer.tsx` | Turns a verdict into a screen, a redirect or its children. Decides, never waits |

- A waiter sits above the bouncer that reads the same data
- Providers mount in `getRouter`'s `Wrap` (`src/router.tsx`), or `InnerWrap` when they read the
  router. Never a waiter nor a bouncer there: `Wrap` sits above the document shell, and withholding
  its children drops `<Scripts />`, so the page never boots. What gates goes in `__root.tsx`'s
  `component` or below

## UI

- Components come from `strategydance-design-system`, and a primitive it lacks is added there, with
  a story. `src/components/ui/` holds glue alone
- Text a page writes into a field goes through `replaceTextareaRange` (`~utils/common`), so the
  caret and undo take it as typing
- A field's text is 16px on a touch screen (`pointer-coarse:text-base`, in `inputClassName`), or iOS
  zooms in. Never `maximum-scale=1`, which stops Android's pinch zoom
- A design-system component that names itself in English takes its label from `react-intl` here,
  as `~components/common/Spinner` does. BlockNote translates its own menus: `RichTextEditor` takes
  the app's `locale`, and its placeholder and `labels` alone from the catalogues
- A member's message is drawn as typed, never as Markdown, its mentions alone as links
  (`parseConversationMemberText`)
- `public/` is served unhashed from the site root, images under `public/assets/images/`. Hosting
  caches `/assets/*`, Vite's hashed bundles, for a year: never `/assets/**`, which would pin an
  edited image

## Data

- `src/data/firebase.ts` alone initializes Firebase. Guard what touches a browser global with
  `isBrowser`: SPA mode prerenders the shell in Node
- Development, `bun run preview` included, talks to the emulators. A Hosting preview channel writes
  production data: look at it, never sign up on it
- Read a query that takes variables through `useQuery` and `executeQuery`, never the generated hook,
  which carries the old variables' data into the new key for a render
- A live list subscribes beside its first read and writes each push into the TanStack cache: copy
  `useOrganizationTeam`
- A query a waiter and its page both read sets `retryOnMount: false` and tells a failed read from an
  empty one (`hasFailed`), or the two retry each other forever
- The backend is called through `requestApi` (`~data/api`), a file sent through `uploadApiFile` and
  read through `requestApiFile`, never an `<img>` pointed at the backend
- A member's change to the Today data or the board calls `recordActivity` once it goes through,
  which the build in public streak counts. An agent's change never does
- What a reader has under way in a conversation, a composer's draft, an upload or an answer, lives
  in a tab store under `~data/` (`createTabStore`), never in a view's state. A thread scrolls through
  `readConversationViewport` and `scrollConversationToEnd`, never `window`
- The Budget turns an `Int64String` into a number where it reads it, writes amounts and days
  through `utils/budget/`, a currency's digits from `CURRENCIES`, never `Intl`, and computes through
  `useBudgetSummary`. Whatever opens a bill passes `state: { isFromBudgetPage: true }`, so closing
  steps back

## Routing

- The authenticated pages sit under the pathless `_authenticated.tsx`, so they share the root with
  the public ones: two static routes at one path fail the build
- An organization's pages sit under `$organizationSlug`. No page at the root may be named like a
  slug, a dash and four letters or digits at its end (`routeTree.test.ts`), and no other `$param`
  sits at the root
- The path names the current organization: a link takes it from `useCurrentOrganizationSlug`, and
  switching goes through `useSwitchOrganization`
- TanStack parses each query value as JSON, so an id the backend puts in an address is hyphenated
  (`toHyphenatedUuid`), and `validateSearch` takes a string alone. A key it leaves out stays: write
  `undefined` over one that fails
- `<Navigate>` navigates again whenever its props change: redirect from an effect on the verdict,
  as `AuthenticationBouncer` does
- `isAuthenticationPath` (`~utils/authentication`) says whether a path is a sign-in screen. The page
  a signed-out reader asked for waits in localStorage, never in the address, kept by
  `AuthenticationBouncer`: a new way in from the sign-in screen goes through a page that mounts it
- `/oauth` and `/integrations` are never framed (`firebase.json`): their pages sit under
  `_authenticated`, outside `_app`. The consent page reads its request once, never again on focus,
  reconnecting or retry, since a read after the decision finds it gone
- `firebase.json` redirects `/-/<path>` through a `regex` whose capture starts with a letter or a
  digit, or `/-//evil.example` would send a browser to another host
- `notFound()` and an unmatched address render `NotFound`, its strings in `global`

## Internationalization

- Every string a member reads is a message in `src/data/intl/messages/*.ts`, its id a unique
  `<messageType>.<path>`. A new message type takes its module, an entry in `MESSAGE_TYPES` and an
  `IntlMessagesRegistration` on its route
- `bun run translate` runs whenever a message changes, and its locale files and lock go in the same
  commit, or six locales ship in English
