# The backend's image, built by Cloud Run from the repository root: `bun run deploy:backend`
# uploads the whole workspace, minus `.gcloudignore`, because the backend imports its sibling
# packages by name.
#
# A full install rather than a production one. `postinstall` generates the Data Connect SDKs the
# backend imports, and it does that with `firebase-tools`, which is a devDependency
FROM oven/bun:1.4

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

ENV PORT=8080
EXPOSE $PORT

CMD ["bun", "run", "start:backend"]
