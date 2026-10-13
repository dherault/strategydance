# strategydance-directories

The places a startup can be submitted to, websites and Reddit communities, in
`src/directories.json`, exported as `DIRECTORIES`, and the ones nothing can be submitted to today,
in `src/inactiveDirectories.json`, exported as `INACTIVE_DIRECTORIES`.

Both lists were read on 2026-10-13 from the README of
[mmmmingos/where-to-submit-your-startup](https://github.com/mmmmingos/where-to-submit-your-startup).
`DIRECTORIES` holds its directories, the ones only for some startups, and its Reddit communities,
without its notes and dates. Each business model was read from those notes:
`DIRECTORY_BUSINESS_MODEL_DESCRIPTIONS`, in `src/constants.ts`, says what each one means, and
`DIRECTORY_BUSINESS_MODEL_PRECEDENCE` which one a site takes when it has several catches.
`INACTIVE_DIRECTORIES` holds the sites and communities under its "Reported submission problems",
each with the reason its note gave, a `DirectoryInactiveReason`.

Each entry holds:

- `name`
- `type`: `WEBSITE` or `REDDIT_COMMUNITY`
- `rootUrl`: the site's origin, or a Reddit community's own page, since reddit.com itself is never
  down
- `submissionUrl`: where a startup is submitted
- `description`: empty for now
- `businessModel`: a `DirectoryBusinessModel`, `UNKNOWN` for every inactive one
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

A directory is in one list or the other, never both: the tests hold names, submission URLs and
websites' roots unique across the two. Both files are sorted by name and written as
`JSON.stringify(list, null, 2)` writes them, which is how the formatter lays them out.
