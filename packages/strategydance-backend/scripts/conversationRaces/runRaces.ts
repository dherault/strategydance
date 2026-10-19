import { dataConnect } from '~firebase'

import { tearDown, webConnector } from './raceFixtures'
import {
  JITTERS,
  type RaceScenario,
  formatTimeline,
  haveWritesOverlapped,
  logOperations,
  readPostgresLog,
  readRefusal,
  startRound,
} from './raceHarness'
import sendScenarios from './sendScenarios'
import subagentScenarios from './subagentScenarios'
import suspensionScenarios from './suspensionScenarios'

const SCENARIOS: RaceScenario[] = [...sendScenarios, ...subagentScenarios, ...suspensionScenarios]

export const SCENARIO_NAMES = SCENARIOS.map(({ name }) => name)

/*
  Runs each scenario named, every one when none is, for as many rounds, each round releasing its
  writers in the next of the jitters, then reads what Postgres logged meanwhile. A scenario fails
  when any round's checks fail, which prints the first such round's interleaving, when Postgres
  detected a deadlock, or when no round had two writers' writes in flight at once, since writers that
  never met raced nothing. It says how many rounds met, and how many lock waits Postgres logged,
  which a round only has when writers met on one row. Answers how many scenarios failed
*/
async function runRaces({ rounds, names }: { rounds: number; names: string[] }) {
  const scenarios = names.length ? SCENARIOS.filter(({ name }) => names.includes(name)) : SCENARIOS
  let failedScenarios = 0

  logOperations(dataConnect)
  logOperations(webConnector)

  try {
    for (const scenario of scenarios) {
      const since = new Date()
      let failedRounds = 0
      let metRounds = 0
      let report: string[] = []

      for (let round = 1; round <= rounds; round++) {
        const jitter = JITTERS[(round - 1) % JITTERS.length]!
        const failures: string[] = []

        startRound()

        try {
          await scenario.run({
            round,
            jitter,
            expect(name, hasPassed, detail) {
              if (!hasPassed) failures.push(detail ? `${name}: ${detail}` : name)
            },
          })
        } catch (error) {
          failures.push(`the round threw: ${readRefusal(error)}`)
        }

        if (haveWritesOverlapped()) metRounds++

        if (failures.length === 0) continue

        failedRounds++

        if (report.length === 0) {
          report = [
            `round ${round}, writers released with ${jitter === 'none' ? 'no jitter' : `jitter on ${jitter}`}:`,
            ...failures.map(failure => `  ${failure}`),
            '  interleaving:',
            ...formatTimeline().map(line => `    ${line}`),
          ]
        }
      }

      const { lockWaits, deadlocks } = readPostgresLog(since)
      const hasPassed = failedRounds === 0 && deadlocks.length === 0 && metRounds > 0

      console.log(
        `${hasPassed ? 'ok    ' : 'FAILED'}  ${scenario.description} (${rounds} rounds, ${metRounds} met, ${lockWaits} lock waits${failedRounds ? `, ${failedRounds} failed` : ''})`,
      )

      for (const line of report) console.log(`        ${line}`)
      for (const line of deadlocks) console.log(`        ${line}`)

      if (metRounds === 0) console.log('        no two writers’ writes were ever in flight at once, so nothing raced')

      if (!hasPassed) failedScenarios++
    }
  } finally {
    await tearDown()
  }

  console.log(failedScenarios ? `\n${failedScenarios} scenario(s) failed` : '\nEvery scenario passed')

  return failedScenarios
}

export default runRaces
