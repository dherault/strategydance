import { parseArgs } from 'node:util'

import holdEnqueuedRuns from './conversationRaces/holdEnqueuedRuns'

/*
  Races the bounds conversations' runs keep against a real Postgres, where writers side by side
  meet as they do in production, which the person's emulator never lets them:

    bun run check:conversation-races [--rounds <n>] [--scenario <name>]…

  The package's script serves Data Connect on a throwaway Postgres for it (`withPostgresEmulators.ts`).
  Each scenario releases the backend's own domain functions at once, the writers a member's actions
  and the worker run, on fixtures of their own, many rounds over, then reads what they left: one run
  per conversation, three in flight, five subagent slots, a promotion into each slot freed, a report
  delivered once, a cascade reaching a launch, and a suspension reaching a send. A round that fails
  prints the interleaving of the operations each writer ran, and a scenario whose writers never
  waited on each other's locks, or that Postgres found deadlocked, fails too. It exits non-zero
  naming each scenario that failed.

  Runs stay where their start left them, since the race drives a worker's steps itself where it
  means to (`holdEnqueuedRuns`). It never runs in CI, which runs no emulators: run it before a release
  that changes a run's mutations, as `probe:claude` runs before one that changes a request
*/
if (!process.env.RACES_POSTGRES_CONTAINER || !process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error('This races against a Postgres of its own: run `bun run check:conversation-races`')
  process.exit(1)
}

if (process.env.NODE_ENV !== 'development') {
  console.error('NODE_ENV is not development, which lifts the daily caps: run `bun run check:conversation-races`')
  process.exit(1)
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { rounds: { type: 'string', default: '20' }, scenario: { type: 'string', multiple: true, default: [] } },
})

const rounds = Number(values.rounds)

if (!Number.isInteger(rounds) || rounds < 1) {
  console.error('Usage: bun run check:conversation-races [--rounds <n>] [--scenario <name>]…')
  process.exit(1)
}

// Before anything loads `enqueueRun`, the domain's modules included
holdEnqueuedRuns()

const { default: runRaces, SCENARIO_NAMES } = await import('./conversationRaces/runRaces')
const unknown = values.scenario.filter(name => !SCENARIO_NAMES.includes(name))

if (unknown.length) {
  console.error(`No scenario is named ${unknown.join(', ')}. The scenarios: ${SCENARIO_NAMES.join(', ')}`)
  process.exit(1)
}

process.exit((await runRaces({ rounds, names: values.scenario })) ? 1 : 0)
