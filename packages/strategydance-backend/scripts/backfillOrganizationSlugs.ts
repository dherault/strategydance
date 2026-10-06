import { parseArgs } from 'node:util'

import { createOrganizationSlug, isOrganizationSlugTakenError } from 'strategydance-core'

/*
  Gives every organization without a slug one, from its name, as `CreateOrganization` gives a new
  organization one: the organizations made before slugs, and any a page from before the release
  makes after it. Until it has one, an organization's pages are addressed by its id.

  In the emulators, a dry run then the writes:

    bun run backfill:organization-slugs
    bun run backfill:organization-slugs --apply

  In production, from this package, signed in with Application Default Credentials as an account
  that may write the database (`gcloud auth application-default login`, then
  `gcloud auth application-default set-quota-project strategydance` if a call asks for a quota
  project), and only once the release that adds `Organization.slug` has deployed:

    bun scripts/backfillOrganizationSlugs.ts --production
    bun scripts/backfillOrganizationSlugs.ts --production --apply

  Without `--apply` it reads, says what it would write and writes nothing. The suffixes it shows
  are drawn again when it writes. With it, each organization is written on its own, and only while
  it still has no slug: one somebody gave a slug since is left alone, so a run cut short, or run
  twice, is finished by running it again. A slug another organization holds is drawn again.

  The writes are GraphQL sent through the Admin SDK rather than declared in the backend's
  connector, so nothing that writes another organization's slug is ever deployed. The Admin SDK
  reaches whichever project the environment points it at, so the script refuses to run unless it
  is told which: the emulators by `DATA_CONNECT_EMULATOR_HOST`, which the package's script sets,
  or production by `--production`, never both
*/

type Execute = <Data, Variables extends Record<string, unknown> = Record<string, unknown>>(
  query: string,
  variables?: Variables,
) => Promise<Data>

type OrganizationWithoutSlug = { id: string; name: string }

export type BackfillOutcome =
  | { id: string; kind: 'planned'; slug: string }
  | { id: string; kind: 'written'; slug: string }
  // Somebody gave it a slug between the read and the write
  | { id: string; kind: 'skipped' }
  | { id: string; kind: 'failed'; error: string }

type Options = {
  execute: Execute
  isApplying: boolean
  createSlug?: (name: string) => string
  onOutcome?: (outcome: BackfillOutcome) => void
}

// How many slugs one organization draws before it gives up on the ones others hold
export const MAX_SLUG_ATTEMPTS = 5

// More than production holds, read in one go: the writes take each out of what a second run reads
const READ_LIMIT = 1000

export async function readOrganizationsWithoutSlug(execute: Execute) {
  const { organizations } = await execute<{ organizations: OrganizationWithoutSlug[] }>(
    `query ReadOrganizationsWithoutSlug {
      organizations(where: { slug: { isNull: true } }, orderBy: { createdAt: ASC }, limit: ${READ_LIMIT}) { id name }
    }`,
  )

  return organizations
}

async function writeSlug(
  execute: Execute,
  organization: OrganizationWithoutSlug,
  createSlug: (name: string) => string,
) {
  for (let attempt = 1; ; attempt++) {
    const slug = createSlug(organization.name)

    try {
      // `updatedAt` stays: nobody changed what the organization shows
      const { organization_updateMany: count } = await execute<{ organization_updateMany: number }>(
        `mutation BackfillOrganizationSlug($id: UUID!, $slug: String!) {
          organization_updateMany(where: { id: { eq: $id }, slug: { isNull: true } }, data: { slug: $slug })
        }`,
        { id: organization.id, slug },
      )

      return count
        ? ({ id: organization.id, kind: 'written', slug } as const)
        : ({ id: organization.id, kind: 'skipped' } as const)
    } catch (error) {
      if (attempt < MAX_SLUG_ATTEMPTS && isOrganizationSlugTakenError(error)) continue

      return {
        id: organization.id,
        kind: 'failed',
        error: error instanceof Error ? error.message : String(error),
      } as const
    }
  }
}

export async function backfillOrganizationSlugs({
  execute,
  isApplying,
  createSlug = createOrganizationSlug,
  onOutcome = () => {},
}: Options) {
  const organizations = await readOrganizationsWithoutSlug(execute)
  const outcomes: BackfillOutcome[] = []

  for (const organization of organizations) {
    const outcome: BackfillOutcome = isApplying
      ? await writeSlug(execute, organization, createSlug)
      : { id: organization.id, kind: 'planned', slug: createSlug(organization.name) }

    outcomes.push(outcome)
    onOutcome(outcome)
  }

  return outcomes
}

function describeOutcome(outcome: BackfillOutcome) {
  switch (outcome.kind) {
    case 'planned':
      return `  ${outcome.id}  would be  ${outcome.slug}`
    case 'written':
      return `  ${outcome.id}  is now    ${outcome.slug}`
    case 'skipped':
      return `  ${outcome.id}  has a slug already, left alone`
    case 'failed':
      return `  ${outcome.id}  FAILED: ${outcome.error}`
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      production: { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
    },
  })
  const emulatorHost = process.env.DATA_CONNECT_EMULATOR_HOST

  if (values.production && emulatorHost) {
    console.error(`--production and DATA_CONNECT_EMULATOR_HOST (${emulatorHost}) disagree on where to write: unset one`)
    process.exit(1)
  }

  if (!values.production && !emulatorHost) {
    console.error(
      'Name where to write: `bun run backfill:organization-slugs` for the emulators, or `--production` for the real database',
    )
    process.exit(1)
  }

  // Imported here rather than at the top, so the tests that import this file start no Firebase app
  const { dataConnect } = await import('~firebase')
  const execute: Execute = async <Data, Variables>(query: string, variables?: Variables) =>
    (await dataConnect.executeGraphql<Data, Variables>(query, { variables })).data

  console.log(
    `${values.production ? 'Production' : `The emulators (${emulatorHost})`}, ${values.apply ? 'writing' : 'dry run: nothing is written'}`,
  )

  const outcomes = await backfillOrganizationSlugs({
    execute,
    isApplying: values.apply,
    onOutcome: outcome => console.log(describeOutcome(outcome)),
  })

  const count = (kind: BackfillOutcome['kind']) => outcomes.filter(outcome => outcome.kind === kind).length

  if (!outcomes.length) console.log('Every organization has a slug')
  else if (!values.apply) console.log(`${count('planned')} without a slug. Run again with --apply to write theirs`)
  else console.log(`${count('written')} written, ${count('skipped')} left alone, ${count('failed')} failed`)

  if (count('failed')) process.exit(1)
}

if (import.meta.main) await main()
