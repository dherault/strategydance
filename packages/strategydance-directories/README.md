# strategydance-directories

The places a startup can be submitted to, websites and Reddit communities, in
`src/directories.json`, exported as `DIRECTORIES`.

The list was read on 2026-10-13 from the README of
[mmmmingos/where-to-submit-your-startup](https://github.com/mmmmingos/where-to-submit-your-startup):
its directories, the ones only for some startups, and its Reddit communities. Its notes and dates
were left out, and so were the sites it reports dead or closed to promotion. Each business model
was read from those notes: `DirectoryBusinessModel`, in `src/enums.ts`, says what each one means
and which one a site takes when it has several catches.

Each entry holds:

- `name`
- `type`: `WEBSITE` or `REDDIT_COMMUNITY`
- `rootUrl`: the site's origin, or a Reddit community's own page, since reddit.com itself is never
  down
- `submissionUrl`: where a startup is submitted
- `description`: empty for now
- `businessModel`: a `DirectoryBusinessModel`
- `lastChecked`: null until something checks the directory
