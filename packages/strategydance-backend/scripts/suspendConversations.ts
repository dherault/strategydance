import { parseArgs } from 'node:util'

import suspendConversations from '~domain/conversations/suspendConversations'

/*
  Suspends conversations for an account or an organization, the one lever staff have short of the
  workspace's spend limit, which stops every customer at once, or lifts the suspension:

    bun run suspend:conversations --production <email | organization id or slug> [--lift]   # the project, with Application Default Credentials
    DATA_CONNECT_EMULATOR_HOST=localhost:9399 bun run suspend:conversations <email | organization id or slug> [--lift]   # the emulators

  An address names an account, suspended in every organization it is in, and anything else an
  organization, by its id, hyphenated or not, or its slug, suspended for every member of it. A
  suspension asks every run in flight it reaches to stop, subagents' included, in the write that
  records it, so nothing goes on past its next request; from then on the routes that start or
  continue a run refuse them, a worker claims none of their runs, and their agents launch nothing,
  while they still read and stop. Their pages say so, and to write to david@strategydance.com. A
  lift clears the suspension alone: the runs it stopped stay stopped, for their member to resume.

  It refuses to touch the project unless told to with `--production`
*/
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: { production: { type: 'boolean' }, lift: { type: 'boolean' } },
  allowPositionals: true,
})

if (!process.env.DATA_CONNECT_EMULATOR_HOST && !values.production) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set: pass --production to suspend in the project, or point this at the emulators',
  )
  process.exit(1)
}

const [named] = positionals

if (positionals.length !== 1 || !named) {
  console.error('Usage: bun run suspend:conversations [--production] <email | organization id or slug> [--lift]')
  process.exit(1)
}

const result = await suspendConversations(named, { isLift: values.lift })

if (result.outcome === 'missing') {
  console.error(`No account by that address, and no organization by that id or slug: ${named}`)
  process.exit(1)
}

const { target } = result
const whose =
  target.kind === 'account'
    ? `the account ${target.email} (${target.id}), in every organization it is in`
    : `the organization ${target.name} (${target.slug ?? target.id}), for every member of it`

if (result.outcome === 'lifted') {
  console.log(`Lifted the suspension of conversations for ${whose}`)
} else {
  console.log(
    `Suspended conversations for ${whose}, and asked ${result.runCount} run${result.runCount === 1 ? '' : 's'} in flight to stop, with ${result.subagentRunCount} of their subagents'`,
  )
}

process.exit(0)
