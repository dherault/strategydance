# The backend's image, built by Cloud Run from the repository root: `bun run deploy:backend`
# uploads the whole workspace, minus `.gcloudignore`, because the backend imports its sibling
# packages by name.
#
# A full install rather than a production one. `postinstall` generates the Data Connect SDKs the
# backend imports, and it does that with `firebase-tools`, which is a devDependency
#
# The exact Bun the repository pins in `packageManager`, which CI reads too, so the image never
# runs a patch nothing else was tested on. Bump the two together
FROM oven/bun:1.4.2

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

ENV PORT=8080
EXPOSE $PORT

CMD ["bun", "run", "start:backend"]
