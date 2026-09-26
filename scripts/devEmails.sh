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

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The version `packages/strategydance-emails` pins `react-email` at. The CLI refuses a UI of any
# other version, so the two move together
VERSION=$(sed -n 's/.*"react-email": "\([^"]*\)".*/\1/p' "$REPO/packages/strategydance-emails/package.json")

HOST="${TMPDIR:-/tmp}/strategydance-react-email"

mkdir -p "$HOST"
cd "$HOST"

[ -f package.json ] || echo '{"name":"strategydance-react-email-host","private":true}' > package.json

if [ ! -f "node_modules/@react-email/ui/package.json" ] || ! grep -q "\"version\": \"$VERSION\"" node_modules/@react-email/ui/package.json; then
  bun add --exact "react-email@$VERSION" "@react-email/ui@$VERSION"
fi

exec ./node_modules/.bin/email dev --dir "$REPO/packages/strategydance-emails/src/emails" "$@"
