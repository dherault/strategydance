#!/usr/bin/env bash

# Opens React Email's preview server on the templates in packages/strategydance-emails, on
# http://localhost:3000.
#
# The server is not installed in the repository. Its UI, `@react-email/ui`, is a Next.js app,
# and the Dockerfile's full install would ship it to Cloud Run. And the CLI looks for that UI in
# the directory it runs from, offering to install it there when it is missing: run from the repo,
# that rewrites `package.json` and `bun.lock` with a dependency nothing else asked for.
#
# So it runs from a scratch directory outside the tree, holding the CLI and the UI at the version
# the emails package depends on. `--dir` points back at the templates, whose own imports resolve
# from their own directory rather than from here.
#
# That directory is a cache, not `$TMPDIR`. macOS deletes files there that nobody has read for
# three days, one by one, and leaves the folders standing: a week later `node_modules` still has
# every package's folder and hardly any of their files, and the CLI dies on its first import.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The version `packages/strategydance-emails` pins `react-email` at. The CLI refuses a UI of any
# other version, so the two move together
VERSION=$(sed -n 's/.*"react-email": "\([^"]*\)".*/\1/p' "$REPO/packages/strategydance-emails/package.json")

HOST="${XDG_CACHE_HOME:-$HOME/.cache}/strategydance-react-email"

mkdir -p "$HOST"
cd "$HOST"

cat > package.json <<EOF
{
  "name": "strategydance-react-email-host",
  "private": true,
  "dependencies": {
    "@react-email/ui": "$VERSION",
    "react-email": "$VERSION"
  }
}
EOF

# On every run rather than when the version changes: it is a no-op in milliseconds when nothing
# is missing, and it puts back a package something has emptied
bun install

exec ./node_modules/.bin/email dev --dir "$REPO/packages/strategydance-emails/src/emails" "$@"
