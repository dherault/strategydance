# strategydance-knowledge

What Strategy Dance's agents know of companies in general, as data, one folder of `src/` per kind,
all exported from the package's entry.

Every entry has an `id`, a slug of the name it was first given (`KNOWLEDGE_ID_PATTERN`), which
never changes, even when the entry is renamed, so whatever refers to it keeps finding it. Every list
is sorted by name, as `compareKnowledgeNames` orders it, each entry's fields in the order its kind's
`…_FIELDS` gives, and written as `JSON.stringify(list, null, 2)` writes it, which the formatter
leaves alone. The tests hold each file to all that.

## Directories

The places a startup can be submitted to, websites and Reddit communities, in
`src/directories/directories.json`, exported as `DIRECTORIES`, and the ones nothing can be
submitted to today, in `src/directories/inactiveDirectories.json`, exported as
`INACTIVE_DIRECTORIES`. [directories.md](../../documents/directories.md) says how the daily check
keeps them true.

Both lists were read on 2026-10-13 from the README of
[mmmmingos/where-to-submit-your-startup](https://github.com/mmmmingos/where-to-submit-your-startup).
`DIRECTORIES` holds its directories, the ones only for some startups, and its Reddit communities,
without its notes and dates. Each business model was read from those notes:
`DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS`, in `src/directories/constants.ts`, says what each one
means, and `DIRECTORY_BUSINESS_MODEL_PRECEDENCE` which one a site takes when it has several catches.
`INACTIVE_DIRECTORIES` holds the sites and communities under its "Reported submission problems",
each with the reason its note gave, a `DirectoryInactiveReason`.

Each entry holds:

- `id`: a slug of the name the entry was first given, lowercase letters and digits in words joined
  by dashes (`KNOWLEDGE_ID_PATTERN`), unique across both lists. It never changes, even when the
  directory is renamed, so whatever refers to a directory keeps finding it. A directory added by
  hand takes the slug of its name: diacritics and apostrophes dropped, every other run of
  characters but letters and digits a dash
- `name`
- `type`: `WEBSITE` or `REDDIT_COMMUNITY`
- `rootUrl`: the site's origin, or a Reddit community's own page, since reddit.com itself is never
  down
- `submissionUrl`: where a startup is submitted
- `description`: what the directory lists and for whom, one sentence of
  `MAX_DIRECTORY_DESCRIPTION_LENGTH` characters at most, written by the daily check, empty until it
  has been
- `categories`: the kinds of product the directory lists, each a `DirectoryCategory`, which
  `DIRECTORY_CATEGORY_DESCRIPTIONS` describes, once each and in the enum's order, written by the
  daily check, empty until it has been: `ANY_STARTUP` for one that takes any product, rather than
  every kind, and `REGIONAL` beside the kinds for one that takes a single region's startups.
  `isDirectoryCategoryListValid` says whether a list keeps to all that
- `businessModel`: a `DirectoryBusinessModel`, `UNKNOWN` for those imported as inactive, while one
  the daily check moves there keeps its own
- `lastChecked`: the UTC day (`YYYY-MM-DD`) of the last check, whatever came of it, null until
  something checks the directory
- `unreachableSince`: the UTC day of the first of the checks in a row that could not reach the
  site, null once one reaches it

An inactive entry also holds `inactiveReason`, which `DIRECTORY_INACTIVE_REASON_DESCRIPTIONS`
describes:

- `UNREACHABLE`: does not resolve, refuses or drops every connection, fails TLS, or only errors
- `PARKED`: parked, for sale or expired, a host's default page, or a suspended hosting account
- `REPURPOSED`: the domain now serves something else, or sends visitors to an unrelated site
- `NO_SUBMISSION`: up, with no way to submit, or closed
- `BROKEN_SUBMISSION`: the way to submit is there and fails
- `CLOSED_TO_PROMOTION`: a community whose rules ban promotion, or that Reddit banned

A directory is in one list or the other, never both: the tests hold ids, names, submission URLs
and websites' roots unique across the two. Both files are sorted by name, as `compareKnowledgeNames`
orders them, each entry's fields in the order `DIRECTORY_FIELDS` and `INACTIVE_DIRECTORY_FIELDS`
give, and written as `JSON.stringify(list, null, 2)` writes them. The daily check writes them
through the same three, so its files pass the tests. The formatter leaves both files alone: it would
put a short array, such as a directory's one category, on one line, which `JSON.stringify` never
does.

## Marketing tactics

Ways to market a product, in `src/marketingTactics/marketingTactics.json`, exported as
`MARKETING_TACTICS`. Read on 2026-10-30 from the first Strategy Dance's list,
[`app/src/data/marketingTactics.json`](https://github.com/dherault/strategy.dance-old/blob/main/app/src/data/marketingTactics.json),
then rewritten: overlapping tactics merged into one, such as the two sponsorships or the three ways
of running a community, and each given a channel, a time to results and its metrics. Each holds:

- `id` and `name`
- `description`: what the tactic is, one sentence of `MAX_KNOWLEDGE_DESCRIPTION_LENGTH` characters
  at most
- `howTo`: how to run it, in a few sentences a founder can follow
- `channel`: where it reaches people, a `MarketingTacticChannel`, which
  `MARKETING_TACTIC_CHANNEL_DESCRIPTIONS` describes
- `effort`: how much of the team's time it takes, `LOW`, `MEDIUM` or `HIGH`, which
  `MARKETING_TACTIC_EFFORT_DESCRIPTIONS` describes
- `paid`: whether it costs money beyond time, such as ads, sponsorships, rewards or prizes
- `timeToResults`: how soon it shows results, `DAYS`, `WEEKS` or `MONTHS`, which
  `MARKETING_TACTIC_TIME_TO_RESULTS_DESCRIPTIONS` describes
- `technical`: whether it takes building something, a page, a tool, code or an integration
- `metrics`: what to measure to tell whether it works, each something a run can set a target for
  and read back

## Strategic frameworks

Proven ways to think a company's question through, from simple ideas to whole methods, in
`src/strategicFrameworks/strategicFrameworks.json`, exported as `STRATEGIC_FRAMEWORKS`. Empty until
the first ones are written. Each is written so an agent can apply it, holding:

- `id` and `name`
- `description`: what the framework is, one sentence of `MAX_KNOWLEDGE_DESCRIPTION_LENGTH`
  characters at most
- `whenToUse`: the situation it helps with, which tells an agent when to reach for it
- `inputs`: what it needs to know of the company before it can be applied
- `questions`: what it asks the team, each a question an agent can put to them as it is
- `output`: what applying it produces, such as a decision, a plan or a document
