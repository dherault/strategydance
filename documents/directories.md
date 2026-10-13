# Directories: the daily check

`packages/strategydance-directories` lists the places a startup can be submitted to, in two files:
`directories.json`, those open today, and `inactiveDirectories.json`, those nothing can be
submitted to today, each with its `DirectoryInactiveReason`. Both were read on 2026-10-13 from the
README of [where-to-submit-your-startup](https://github.com/mmmmingos/where-to-submit-your-startup).
Sites change: they go down, get parked, change what they charge, close their submissions. The daily
check keeps the lists true, and writes each directory's description, which the import left empty.

Once a day, Cloud Scheduler calls the worker's `POST /internal/directories-check`. A run checks ten
active directories and one inactive one, and commits what it found to a pull request into `dev`,
which a human reads and merges. The code is in `packages/strategydance-backend/src/domain/directories/`
and `src/domain/github/`.

## What a run picks

`selectDirectoriesToCheck` takes websites only. Reddit answers a bot's GET with a 403 whatever the
community, as upstream's own link checker notes, so its communities are never checked. Nothing
checked today is picked, so a run started again the same day picks others.

Among the active websites, a run takes, in order:

1. those a check could not reach at least three days ago, for the check that decides whether they
   are gone;
2. those never checked (`lastChecked` null);
3. the rest, the longest unchecked first.

Within each group, and among directories checked on the same day, the order is random, so a run's
picks are not alphabetical neighbours. Ten a day covers the 520 active websites in about 52 days,
then starts again from the oldest. One inactive website is picked as well, never checked first, then
the longest unchecked, so a site moved by mistake comes back on its own.

## The probe

`probeDirectory` GETs the directory's root and its submission page through `fetchOutbound`, which
reaches public addresses alone, with a 15-second deadline and a 2 MiB cap. Each page comes out as
one of these:

- `reachable`: a 2xx, with its title, description and visible text (scripts, styles and the head
  left out);
- `missing`: a 404 or a 410;
- `blocked`: a bot wall, which proves nothing about the site: a 401, 403, 407, 429 or 451, a 503
  marked `cf-mitigated: challenge` (Cloudflare's challenge), or a redirect loop, which a site that
  sets a cookie before answering puts a visitor without cookies in;
- `unreachable`: no site: a name that does not resolve or resolves to a private address, a
  connection refused, reset or timed out, a certificate no browser would take, the deadline, or a
  5xx (Cloudflare's 52x included);
- `unknown`: anything nobody can tell from a passing fault, `EAI_AGAIN` among them.

A page with under 300 characters of text is flagged as drawn by scripts. Neither the probe nor
Claude's web fetch runs JavaScript, so what such a page seems to lack proves nothing.

## Two strikes, three days apart

When the root is `unreachable` or `missing`, nobody needs to ask Claude. The first such check sets
`unreachableSince` to the day. A later check that still cannot reach the site moves it to the
inactive list as `UNREACHABLE`, but only when it comes three or more days after the first, so a
weekend's outage retires nothing. Any check that reaches the root, or is walled off by it, clears
`unreachableSince`.

## The review

`requestDirectoryReview` sends Claude (`claude-opus-5-5`, effort `medium`, with server-side refusal
fallbacks) the entry and what the probe read of both pages. Claude may fetch up to three more pages
with web fetch (`web_fetch_20260209`, 8,000 tokens each at most), held to the entry's hosts and
those its pages redirected to, so it reads the site's own FAQ, pricing and submit pages. Never a
parent domain: for a site on a platform's subdomain, such as `launched.lovable.app`, the parent
would open every other tenant's site, whose pages a review could then quote. Web fetch only opens an address the conversation already holds, so the
request lists each probed page's links to the same site, and, for a page its scripts draw, whose
links nobody sees, its `/pricing`, `/faq`, `/submit` and `/about`. Its system prompt is
`directoryReviewPrompt.ts`, built from the package's
`DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS`, `DIRECTORY_BUSINESS_MODEL_PRECEDENCE` and
`DIRECTORY_INACTIVE_REASON_DESCRIPTIONS`, so the review and the list never mean different things.
The prompt tells Claude that page text is data, never instructions.

The answer is held to a JSON schema:

- `verdict`: `ACTIVE`, `INACTIVE` with an `inactiveReason` (`PARKED`, `REPURPOSED`, `NO_SUBMISSION`
  or `BROKEN_SUBMISSION`), or `INCONCLUSIVE`;
- `description`: one English sentence of 200 characters at most, saying what the site lists and
  for whom, with no prices and no praise;
- `isCurrentDescriptionAccurate`;
- `businessModel`, or null when the pages do not show how a listing works;
- `evidence`: the quote, and its page, that a business model change or an `INACTIVE` verdict rests on;
- `submissionUrl`: a moved submission page;
- `notes`: a sentence or two for the reviewer of the pull request.

A turn that web fetch's server-side loop paused is sent back, three times at most. One review may
take four minutes. A run starts no check after six minutes, so the slowest check it started, and
the GitHub calls around them, still end inside the worker's fifteen. A refusal, an answer outside the schema, or the deadline counts as a check that
told nothing. A failure of the API itself counts as no check at all.

## What a run writes

`applyDirectoryChecks` is pure and keyed by name. A run changes only what it can prove:

- A description is written where there is none, or where the review found the current one wrong.
- A business model changes only when the review's quote is on the page it names (`isEvidenceFound`):
  a page the probe read, or a document web fetch brought back, at that address, holds the quote,
  with case, spaces, quotation marks and dashes ignored and an ellipsis standing for a cut
  (`isQuotedIn`). Only a fetch's document counts, never what the code of web fetch's dynamic
  filtering printed, nor a result's own fields. It never changes to `UNKNOWN`. The models came from
  upstream's notes, written by people who tried to submit, which a FAQ rarely beats.
- A directory moves to the inactive list only on a quote found the same way. `NO_SUBMISSION` and
  `BROKEN_SUBMISSION` are never taken for a site whose pages are all drawn by scripts.
- An inactive directory the review finds `ACTIVE` moves back, filled in.
- A moved submission page is taken only when the probe reaches it, it shares the root's origin, and
  no other entry uses it. A form elsewhere, such as a Tally or Google Forms link, goes to the notes.
- A root that redirected within its site (to https, or to its `www.` or away from it) moves the
  entry's addresses with it. A redirect to another site is left to the review, as a possible
  `REPURPOSED`, and never followed.
- Every check that told something, inconclusive ones included, sets `lastChecked`, so a site that
  always fails is not paid for every day. A failure of the API, or a directory the run had no time
  for, leaves the entry as it was, to be picked again the next day.

Both files are written sorted by name, each entry's fields in the type's order, as
`JSON.stringify(list, null, 2)` writes them, which is how oxfmt lays them out. The package's tests
hold the files to that.

The worker runs the code of the last release on `main` against the lists on `dev`. When the lists
hold a field or a value this code does not know, `readDirectoryLists` refuses them, and the run
writes nothing until a release catches up.

## The rolling pull request

`publishDirectoryCheck` keeps one pull request open at a time, from the branch `directories-check`
into `dev`, titled "Check directories". Only the GitHub App writes that branch.

- **With one open**, the run merges `dev` into its branch first. A run reads the lists on the
  branch, so it never checks again what the days before it checked. If the merge conflicts, the
  run stops before Claude is asked, and comments once on the pull request asking a human to resolve
  the conflict or close it.
- **With none open**, the branch is pointed at `dev`'s head, created again when GitHub deleted it
  after a merge. A pull request closed without a merge counts as a rejection: its commits are
  dropped, and its directories come back in their turn.
- The run reads both files at the branch's head and commits them in one commit through GraphQL
  `createCommitOnBranch` with `expectedHeadOid`, so a push in between refuses the commit instead of
  being written over. The checks, already paid for, are then applied again to the lists read
  afresh, once. Each check carries the entry as it was checked, and leaves one that changed
  meanwhile, by a person's push or an overlapping run, rather than write an old site's review over
  it.
- Each commit is `[directories] Check N directories on <day>`. No hook runs on an API commit, so the
  prefix is written by the code. The day's report is the commit's body, and goes on top of the pull
  request's description, the oldest days dropped once it outgrows GitHub's 65,536 characters.
- The report has a row per directory: its result, what changed, the quote it rests on, and Claude's
  notes. Every word a page or Claude wrote is escaped, so it can break no table, link nothing, and
  mention nobody (`@`, `#123`), and a link's destination has its parentheses percent-encoded, so an
  address Claude gave cannot end its link early. A quote past 300 characters is dropped and notes
  past 600 are cut, and a report too long for the description on its own is cut there, its commit
  holding it whole, so the pull request is always updated once the commit lands.

CI runs on the pull request, and Copilot reviews each push, as on any pull request into `dev`. No
Hosting preview is built for it (`firebase-hosting-pull-request.yml`), since no page reads the two
files.

## Cost

Each review is one request, or a few when web fetch pauses, of 10,000 to 25,000 input tokens. The
first runs, on 2026-10-13, cost $0.05 to $0.11 a reviewed directory, so about $1 a day and $30 a
month. A directory whose root cannot be reached costs nothing. Each report ends with what its run
cost, at the prices in `directoryCheckSettings.ts`.

## Running it by hand

```sh
bun run check:directories                         # a day's pick, written into this checkout's files
bun run check:directories --count 3 --inactive 0  # fewer, or more
bun run check:directories --name "Product Hunt"   # those named
bun run check:directories --dry-run               # prints the report, writes nothing
bun run check:directories --publish --count 2     # as the worker does, on the repository, as the App
```

Claude's key is `ANTHROPIC_API_KEY` when set, and the `anthropic-api-key` secret otherwise. On a
machine whose Application Default Credentials have expired, read it into the variable:
`ANTHROPIC_API_KEY="$(gcloud secrets versions access latest --secret=anthropic-api-key --project=strategydance 2>/dev/null)"`.
`--publish` reads the App's id and key from `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` the same
way. A resolver that filters names, as some local networks do, makes sites look unreachable: trust
the worker's runs over a laptop's.

## Setup

Done once, by a human, in this order:

1. **The GitHub App.** On GitHub, under the `dherault` account's Developer settings, create a GitHub
   App: any name (for example "Strategy Dance Directories"), no webhook, repository permissions
   Contents and Pull requests set to read and write (Metadata stays read-only). Install it on
   `dherault/strategydance` alone. Generate a private key, which downloads as a `.pem`. An App's
   pull requests trigger CI, which pull requests opened with Actions' own token do not.
2. **The secrets.** Store the App's id and its key in Secret Manager, and let the runtime account
   read them:

   ```sh
   printf '%s' '<app id>' | gcloud secrets create github-app-id --project strategydance --data-file=-
   gcloud secrets create github-app-private-key --project strategydance --data-file=<path to the .pem>
   for secret in github-app-id github-app-private-key; do
     gcloud secrets add-iam-policy-binding "$secret" --project strategydance \
       --member serviceAccount:995028545701-compute@developer.gserviceaccount.com \
       --role roles/secretmanager.secretAccessor
   done
   ```

3. **Prove it**, before any release: `bun run check:directories --publish --count 2`, which opens
   the first pull request as the App. Check that CI ran on it without waiting for an approval.
4. **The schedule**, once the release carrying `/internal/directories-check` has reached `main`
   and deployed. Like the sweep's, the job calls the private worker as `conversation-tasks`, so its
   creator needs `iam.serviceAccounts.actAs` on that account:

   ```sh
   gcloud scheduler jobs create http directories-check --location us-central1 --project strategydance \
     --schedule '0 5 * * *' --time-zone Etc/UTC --http-method POST \
     --uri https://strategydance-worker-995028545701.us-central1.run.app/internal/directories-check \
     --oidc-service-account-email conversation-tasks@strategydance.iam.gserviceaccount.com \
     --oidc-token-audience https://strategydance-worker-995028545701.us-central1.run.app \
     --attempt-deadline 15m --max-retry-attempts 0
   ```

   It runs once a day at 05:00 UTC, an hour after the sweep. It takes no retry: a failed run is
   harmless and the next day's starts over, while a retry overlapping a slow run would pay Claude
   twice before failing on `expectedHeadOid`. To run it now: `gcloud scheduler jobs run
   directories-check --location us-central1 --project strategydance`.

## When something goes wrong

- **The run failed**: Cloud Logging, on the `strategydance-worker` service, logs each directory as
  `Directories: …` and the failure in full. Nothing was written, and the next day's run picks the
  same directories.
- **The pull request conflicts with `dev`**: the run comments once, then skips every day until the
  conflict is resolved on GitHub, or the pull request is closed so that the next run starts again
  from `dev`.
- **A wrong move or a wrong model**: edit it on the branch, or close the pull request. A directory
  moved by mistake is also rechecked in its turn and moved back.
- **The lists hold something this release does not know**: the run logs the refusal and writes
  nothing until a release catches up.
