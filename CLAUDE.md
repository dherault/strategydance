# CLAUDE.md

Guidance for Claude Code and the reviewers. `AGENTS.md` is a symlink to it: edit `CLAUDE.md` only.
A package with conventions of its own keeps them in its own `CLAUDE.md`, which Claude Code reads
when it works there: the backend, the database, the web, the design system and the emails.

**Every change to a tracked file ships without asking**: on its own branch, committed granularly,
pushed, opened as a pull request into `dev` and taken through the CodeRabbit review loop, until all
that is left for a human is the merge. [Workflow](#workflow) says how.

## Vision

Strategy Dance aims to create partly autonomous companies run by humans and AIs together. It starts
as an overseer and companion for solo entrepreneurs, helping them build, distribute, stay
accountable and act on their projects, its AI guidance growing into AI execution, then AI employees
for existing organizations and companies run entirely by AI. The challenge is a universal system for
creating and running a company, and the answer lies in architecture and design.

## Stack

A [Bun](https://bun.com) workspaces monorepo. A package imports another by its name.

| Package | What it holds |
| --- | --- |
| `strategydance-web` | The app: TanStack Start in SPA mode, React 19 with the React compiler, Tailwind CSS v4, Vite |
| `strategydance-backend` | A Bun and Express server on Cloud Run, for what needs a secret or the server's word: invitations, uploads, conversations and their agent, the modules, OAuth, integrations. Its image runs again as the private worker |
| `strategydance-database` | Firebase Data Connect: the Postgres schema, one connector per caller, the SDK generated from them |
| `strategydance-design-system` | The components, shadcn on Radix, in Storybook, and the rich text's editor, renderer and helpers |
| `strategydance-core` | Types, enums and constants every package shares, and the Budget's computations. It has no runtime dependency, so the browser and Node both load it: keep it so |
| `strategydance-knowledge` | What the agents know of companies in general, as data: strategic frameworks, and where a startup can be submitted ([directories.md](documents/directories.md)). An entry's `id` never changes, and every list stays sorted by name as `JSON.stringify(list, null, 2)` writes it |
| `strategydance-external-mcp-servers` | The MCP servers an organization adds in a click, as data. Its README says how one is added |
| `strategydance-emails` | The transactional emails, as React Email templates the backend renders |
| `strategydance-translations` | The Gemini CLI that fills the locale catalogues. Node only |

`documents/` holds what people read, in Markdown alone. A feature with a document,
[conversations.md](documents/conversations.md), [budget.md](documents/budget.md),
[directories.md](documents/directories.md) or [design-sync.md](documents/design-sync.md), is read
there before it is changed: this file keeps the rules, the documents the reasons.

`bunfig.toml` holds installs to versions published at least a week ago.

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | The web on http://localhost:5173, beside `dev:emulators`, and `dev:backend` for anything calling the backend |
| `bun run dev:emulators` | The Auth, Data Connect and Storage emulators, with a UI on http://localhost:4000 |
| `bun run dev:backend` | The backend on http://localhost:3003. It answers conversations with Claude, which costs money, unless started with `CONVERSATION_AGENT=placeholder` |
| `bun run dev:emails` / `storybook` | React Email's preview on http://localhost:3000, Storybook on http://localhost:6006 |
| `bun run lint` / `lint:fix` / `format` | oxlint, then oxfmt's check; oxlint's safe fixes, then formatting; formatting alone |
| `bun run typecheck` / `test` / `build` | `tsc` across the packages; `bun test`, each file in a fresh global; Storybook, then the web |
| `bun run preview` | Builds against the emulators and serves it on http://localhost:5050 |
| `bun run translate` | Fills the locale catalogues from the `defaultMessage`s |
| `bun run review <command>` | The review loop's GitHub calls |
| `bun run kill` / `kill:backend` / `kill:emulators` | Kills whatever listens on their ports |
| `bun run grant:administrator <email>` | Makes an account an administrator of Strategy Dance, in the emulators |
| `bun run ship` / `deploy:*` | Humans only (see [Workflow](#workflow)) |

The backend's scripts, its checks against the emulators, probes, seeds and modules over stdio, are
listed in its `CLAUDE.md`.

**CI is green** when `bun run lint && bun run typecheck && bun run test && bun run build` passes
from the root.

Never edit by hand what a generator writes: `routeTree.gen.ts`, written by the router plugin and
committed, the database's `generated/`, written on `postinstall` and ignored, and the translated
catalogues with `translations.lock.json`, written by `bun run translate`.

## Linting and formatting

`bun run lint` fails on a warning, an unformatted file or a disable directive that suppresses
nothing, in CI and in the `pre-commit` hook. In Claude Code, a hook runs `oxlint --fix` and oxfmt on
each edited file, and another typechecks when a turn ends.

- One config, the root's: a nested `.oxlintrc.json` replaces it rather than extending it. A
  package's rule goes in the root's `overrides`
- oxfmt owns layout and import order, in the groups `.oxfmtrc.json` lists, one per alias, so a new
  `~` alias needs its group. A `className`'s class order alone is kept by hand. A `///
  <reference>` moves with the import below it: keep it above the import that sorts first
- Markdown, HTML and generated files are not formatted
- `--fix` leaves an unused import as an error: write an import with the code that uses it
- Suppress with `// oxlint-disable-next-line <rule>` under oxlint's names (`react/exhaustive-deps`),
  which covers the line below as formatted

## Across packages

- Never `useCallback` nor `useMemo`: the React compiler memoizes, and `.oxlintrc.json` reports what
  it would refuse as `react/*` rules. When `exhaustive-deps` flags a function of a component's body,
  define it inside the effect, or call the stable thing directly
- No em dash in a `defaultMessage`, a `description` or an email: a full stop, a comma or a colon.
  It reads as machine-written, and every locale inherits it

## Releases and production

Every push to `main` runs `.github/workflows/deploy-merge.yml`: Data Connect, the backend and the
worker, the Storage rules, then the frontend, each waiting on the one before. It runs as
`deployer@strategydance.iam.gserviceaccount.com` through Workload Identity Federation, since the
organization forbids keys, so pushing to `main` is as good as holding production. It never passes
`--force`: a migration that drops anything, a breaking connector change or a new insecure operation
stops the release before the backend moves, until a human reads the printed SQL, runs `bun run
deploy:database` and re-runs the deploy, which refuses once `main` has moved past it.

- A Hosting preview runs only by hand, `firebase-hosting-pull-request.yml` from the Actions tab
  with the pull request's number, and `delete-preview-channel.yml` frees its channel. Both run
  `main`'s copy, so a change to either takes effect with the release
- Storage's `storage.cors.json` and `storage.lifecycle.json` are bucket settings no deploy sends:
  after changing one, run `gcloud storage buckets update gs://strategydance.firebasestorage.app`
  with `--cors-file` or `--lifecycle-file`. App Check enforcement is a console setting, per service

## Tackling a task

"Tackle task 123", or anything like it, names a task of the team's board in Strategy Dance: read it
through the `strategydance-tasks` MCP server, which acts as the person in production, never a
`-local` one, then do what it asks under the [Workflow](#workflow).

- What follows "task" is an id, which `read_task` takes hyphenated or not, or a piece of its name,
  which `list_tasks` finds with `query`. Several matches are a question for the person, never a pick
- The description is the brief: `read_task` opens a `task:<id>` link, and the Documents module's
  `read_document` a `doc:<id>` one. A task it waits on that is not done blocks it: say so first
- Without `strategydance-tasks` tools, or when they ask to sign in, say so and stop: the person
  runs `claude mcp add --transport http strategydance-tasks https://api.strategydance.com/mcp/tasks`,
  then `/mcp`
- `update_task` moves it to `ONGOING` before the first edit, and to `DONE` once its pull request
  merges (`bun run review open` says `MERGED`, or the person does), naming the tasks that can start
  now (`canStartNow`). Nothing else on the board changes unless the person asks

## Workflow

**This is the person's standing request in every session.** A task that changes a tracked file,
however small, goes branch → granular commits → push → pull request into `dev` → CodeRabbit review
loop → handed to a human, in one go. Never ask whether to commit, push, open the pull request or
address the review: the answer is yes, and a turn that ends on such a question has failed. Work is
done when its pull request is green, reviewed and waiting for a human.

It does not apply to a task that changes nothing tracked, such as a question or a review, and gives
way when the person says otherwise for the task at hand ("don't commit", "just try it"). Three
things stay a human's call: merging a pull request, the release to `main` and the `deploy:*`
scripts. A turn ends with the pull request handed over, or blocked on what only the person can
supply: a credential, a product decision, a check failing for a reason outside the change.

This section reads the same in sunshine and strategydance but for each repository's commands, and
`scripts/codeRabbitReview.sh` and `scripts/ship.sh` are the same file in both: an improvement to one
goes to the other.

### Where to work

One session at a time, the **primary**, works in the main checkout, on a branch of its own: the
person's dev servers serve that checkout, so they see its edits land. Every other session works in
a worktree and never edits, switches or commits in the main checkout.

Settle which you are before the first edit. A main checkout on a clean `dev` is free: become the
primary, checking and branching in one command, then tell the other sessions.

```sh
git fetch origin dev
test "$(git branch --show-current)" = dev && test -z "$(git status --porcelain)" && git switch --no-track -c <branch> origin/dev
```

Read `git branch --show-current` again before the first edit and every commit there, since two
sessions can switch at once and the later wins: another branch means a worktree, and `dev` means the
switch did not stick. Otherwise, work in a worktree, every edit, test, commit and push included:

```sh
git fetch origin dev
git worktree add --no-track -b <branch> .claude/worktrees/<branch> origin/dev
cd .claude/worktrees/<branch>
bun install --frozen-lockfile  # its postinstall generates the Data Connect SDK
ln -s <main checkout>/packages/strategydance-translations/.env packages/strategydance-translations/.env  # if the main checkout has one
```

- Branch from a freshly fetched `origin/dev`, never local `dev`. `--no-track` leaves the upstream to
  the first `git push -u origin HEAD`
- `EnterWorktree` branches from `origin/main`, which lags `dev`: create the worktree as above and
  pass it its `path`
- To ship uncommitted work sitting in the main checkout, copy it over with `git -C <main checkout>
  diff HEAD --binary | git apply` and its untracked files by hand, leaving the original to the person
- The person's stack holds ports 5173 and 3003. Serve a worktree's web on the first free port from
  5174 (`lsof -nP -iTCP:<port> -sTCP:LISTEN` prints nothing), `bunx vite --port <port>
  --strictPort` in `packages/strategydance-web`, and aim a browser at that port alone
- Remove the worktree once its pull request merges: `git worktree remove .claude/worktrees/<branch>`

**The main checkout changes hands only on the person's word**: at the end of the loop, a session in
a worktree asks whether they want its branch checked out, and "check it out" is the same yes.

1. Unless the checkout is on a clean `dev`, message each other session of this repository
   (`ListAgents` names them `strategydance-…`): you are taking it for `<branch>`, the session on
   `<its branch>` moves to a worktree and says when it is free, and any other answers that it is not
   theirs. Wait, since silence is not consent.
   When no session claims the branch, go on if the checkout is clean, telling the person whose
   branch it was, and otherwise say what is there and stop
2. The primary, asked, moves to a worktree with its uncommitted work, never committing it half done
   nor stashing, since every worktree shares the stash:

   ```sh
   git switch --detach  # in the main checkout
   git worktree add .claude/worktrees/<branch> <branch>
   cd .claude/worktrees/<branch>
   git -C <main checkout> diff HEAD --binary | git apply  # untracked files by hand
   bun install --frozen-lockfile  # and the translations link
   ```

   Once `git status --short` lists the same paths in both, it takes its work out of the main
   checkout (`git -C <main checkout> restore --staged --worktree .`, deleting its untracked files)
   and answers that the checkout is free. When the checkout holds anything else, it leaves it as it
   is and tells the asking session and the person
3. The new primary moves in with its uncommitted work:

   ```sh
   git switch --detach  # in its worktree
   cd <main checkout> && git switch <branch>
   git -C .claude/worktrees/<branch> diff HEAD --binary | git apply  # untracked files by hand
   git worktree remove .claude/worktrees/<branch>  # --force once git status matches
   ```

4. It tells every other session that it is the primary, and on which branch

Around every switch in the main checkout: run `bun install --frozen-lockfile` when dependencies or
the database package changed; when the Data Connect emulator listens on 9399, tell the person first,
who may stop it or export its data, since it migrates as the schema changes on disk and drops what
it cannot migrate additively; never pass `--ignore-other-worktrees`; and leave `EnterWorktree` first
(`ExitWorktree`, keeping the worktree).

When the primary's pull request merges, it runs `git fetch origin dev`, and once `git log
origin/dev..HEAD` lists nothing and the checkout is clean, `git switch dev && git merge --ff-only
origin/dev`, then tells the other sessions the checkout is free. A request for the checkout is
answered the same way, rather than by moving to a worktree.

### Commit as you go

`dev` is the integration branch, which every pull request starts from and goes back into. Never
commit to `dev` or `main`, and never leave a branch with commits but no pull request.

- One logical change per commit, each passing CI's four commands on its own, since the `pre-commit`
  hook only lints: a dependency bump, a refactor and a feature are three commits. Commit each piece
  as it passes, without waiting for the rest
- When a message changed, `bun run translate` runs first, and its files go in the same commit
- Stage by path, never `git add -A` nor `.`, after reading `git status --short`: the Firebase CLI
  drops files in the tree, and an unexpected path belongs in `.gitignore`
- Write the subject in the imperative, saying what the change does, without a scope: the
  `commit-msg` hook prepends one from the staged paths (`[web]`, `[backend]`…), and keeps one
  written by hand, wrong or not. A commit across packages is `[root]`, a reason to keep one within a
  package where it is natural

### Open the pull request

Once the code is committed, in the same turn:

```sh
git push -u origin HEAD
gh pr create --base dev --title '<what the change does>' --body-file - << 'EOF'
<what changed and why, and how it was verified>
EOF
```

`--base dev` is required, since the default branch is `main`, and a pull request is never a draft,
which CodeRabbit skips. The person may merge at any moment, so every push and description edit goes
behind `bun run review open <number> &&`, which fails unless the pull request is open. On `MERGED`,
open a new pull request for what `git log origin/dev..HEAD` lists; on `CLOSED`, stop and ask.

### CodeRabbit review loop

CodeRabbit reviews each push to a pull request into `dev`, writing its progress into the head
commit's `CodeRabbit` status. `bun run review` (`scripts/codeRabbitReview.sh`) holds the loop's
GitHub calls, since a worktree session refuses `gh` inside `$(…)` or a loop.

1. Run `bun run review wait <number>` in the foreground, in the same turn. It returns once the
   pushed head is reviewed, asking CodeRabbit when it waits to be asked, and exits 75 after nine
   minutes: run it again until it returns. Never ask by hand, since the account has ten reviews an
   hour, sunshine's and strategydance's together. A clean round leaves no review at all
2. Wait for CI (`gh pr checks <number> --watch`) and fix what fails
3. Answer every finding, with a fix or a reply saying why it does not apply, checking its *Prompt
   for AI Agents* against the code first. Reply on each thread, then resolve it, never the other way:
   `bun run review threads <number>`, `bun run review reply <thread id> -` with the reply on stdin,
   `bun run review resolve <thread id>`. Read the review's body too (`bun run review body
   <number>`): answer its *Outside diff range* and *Duplicate* comments in one `gh pr comment`, and
   fix a nitpick that is right
4. Commit the fixes granularly, then push them as one batch behind the open check, once the round
   is answered: a push while a review runs spends it on a head about to be replaced
5. Repeat from step 1 until a round brings nothing but nitpicks or praise

### Hand the pull request to a human

Never merge a pull request, nor set it to merge itself. Once CI is green and the review clean, say
so with its link and, unless you are the primary, ask in the same message whether the person wants
the branch checked out on the main checkout, a yes being a handover. Then stop. Humans merge with a
merge commit, never a squash, since the granular commits are the point.

### Ship `dev` to `main`

A release is a human's call, since it deploys everything, the database included. `bun run ship`
(`scripts/ship.sh`) opens the "Ship dev to main" pull request, or finds the open one, and sets it to
merge itself once `ci` passes, so what lands on `dev` meanwhile ships with it. It refuses while
local `dev` holds unpushed commits, and `gh pr merge <number> --disable-auto` holds a release back.
`main` takes pull requests alone.
