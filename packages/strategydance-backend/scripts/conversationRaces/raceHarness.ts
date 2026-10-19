import { AsyncLocalStorage } from 'node:async_hooks'
import { setTimeout as wait } from 'node:timers/promises'

import type { DataConnect } from 'firebase-admin/data-connect'

// How writers are released, which the rounds go through in turn: all at once, each after a delay of
// its own, or each operation after one, which is what reaches between a domain's read and its write
export type Jitter = 'none' | 'writers' | 'operations'

export const JITTERS: Jitter[] = ['none', 'writers', 'operations']

// How long a writer may be held back, about what a domain's read takes, so a write of one lands
// anywhere in another's read and write
const WRITER_JITTER_MS = 40

// How long an operation may be held back
const OPERATION_JITTER_MS = 15

type Call = {
  writer: string
  operation: string
  isWrite: boolean
  startedAt: number
  endedAt: number | null
  refusal: string | null
}

const writers = new AsyncLocalStorage<string>()

let calls: Call[] = []
let origin = 0
let operationJitterMs = 0

// The cause of a refusal, which the Admin SDK puts on the first line of its message
export function readRefusal(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''
}

/*
  Logs every operation a writer runs through a connector, as the generated SDK runs them, by
  `executeQuery` and `executeMutation`: which writer, when it started and ended, and whether it was
  refused. What runs outside a writer, the fixtures and the reads a round checks with, is not logged
*/
export function logOperations(connector: DataConnect) {
  for (const method of ['executeQuery', 'executeMutation'] as const) {
    const original = connector[method].bind(connector) as (...args: unknown[]) => Promise<unknown>

    const logged = async (...args: unknown[]) => {
      const writer = writers.getStore()

      if (!writer) return original(...args)

      if (operationJitterMs) await wait(Math.random() * operationJitterMs)

      const call: Call = {
        writer,
        operation: String(args[0]),
        isWrite: method === 'executeMutation',
        startedAt: performance.now(),
        endedAt: null,
        refusal: null,
      }

      calls.push(call)

      try {
        return await original(...args)
      } catch (error) {
        call.refusal = readRefusal(error)

        throw error
      } finally {
        call.endedAt = performance.now()
      }
    }

    connector[method] = logged as (typeof connector)[typeof method]
  }
}

// What a round's operations did, by writer, in the order they started and ended
export function formatTimeline() {
  const events = calls.flatMap(call => [
    { at: call.startedAt, line: `${call.writer}  → ${call.operation}` },
    ...(call.endedAt === null
      ? []
      : [
          {
            at: call.endedAt,
            line: `${call.writer}  ← ${call.operation} ${call.refusal === null ? 'ok' : `refused: ${call.refusal}`}`,
          },
        ]),
  ])

  return events
    .sort((a, b) => a.at - b.at)
    .map(({ at, line }) => `+${(at - origin).toFixed(1).padStart(7)} ms  ${line}`)
}

// How many of a round's operations of that name went through
export function countPassed(operation: string) {
  return calls.filter(call => call.operation === operation && call.endedAt !== null && call.refusal === null).length
}

// Whether two writers' writes were in flight at once, which, through emulators taken in turn, run side
// by side in Postgres
export function haveWritesOverlapped() {
  const writes = calls.filter(({ isWrite }) => isWrite)

  return writes.some(a =>
    writes.some(
      b => a.writer !== b.writer && a.startedAt < (b.endedAt ?? Infinity) && b.startedAt < (a.endedAt ?? Infinity),
    ),
  )
}

// Starts a round's log
export function startRound() {
  calls = []
  origin = performance.now()
}

/*
  Releases writers at once, each in its own context, so what it runs is logged as its own, and
  settles them all, whatever each answers or throws
*/
export async function race<T>(entries: Record<string, () => Promise<T>>, jitter: Jitter) {
  let release = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })

  operationJitterMs = jitter === 'operations' ? OPERATION_JITTER_MS : 0

  const running = Object.entries(entries).map(([writer, run]) =>
    writers.run(writer, async () => {
      await gate

      if (jitter === 'writers') await wait(Math.random() * WRITER_JITTER_MS)

      return run()
    }),
  )

  release()

  const settled = await Promise.allSettled(running)

  operationJitterMs = 0

  return Object.fromEntries(Object.keys(entries).map((writer, index) => [writer, settled[index]!])) as Record<
    string,
    PromiseSettledResult<T>
  >
}

// What a writer answered, or why it threw
export function describe<T>(result: PromiseSettledResult<T> | undefined) {
  if (!result) return 'nothing'

  return result.status === 'fulfilled' ? JSON.stringify(result.value) : `threw ${readRefusal(result.reason)}`
}

/*
  What Postgres logged since a scenario started: the lock waits past its `deadlock_timeout`, which
  say writers met, and the deadlocks, which say two writers took their locks in orders that cross
*/
export function readPostgresLog(since: Date) {
  const container = process.env.RACES_POSTGRES_CONTAINER ?? ''
  const { exitCode, stdout, stderr } = Bun.spawnSync(['docker', 'logs', '--since', since.toISOString(), container], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Postgres logs to stderr, which `docker logs` hands back as its own, so only its exit status tells
  // a log read from one that could not be: a log never read would pass every scenario unchecked
  if (exitCode !== 0) throw new Error(`Postgres' log could not be read: ${stderr.toString().trim()}`)

  const lines = `${stdout.toString()}\n${stderr.toString()}`.split('\n')

  return {
    lockWaits: lines.filter(line => line.includes('still waiting for')).length,
    deadlocks: lines.filter(line => line.includes('deadlock detected')),
  }
}

// One round of a scenario: its number, how its writers are released, and how it says what failed
export type RaceRound = {
  round: number
  jitter: Jitter
  expect(name: string, hasPassed: boolean, detail?: string): void
}

/*
  A race run many times over, each round on fixtures of its own. Its name picks it with
  `--scenario`, and its description is the line the check prints
*/
export type RaceScenario = {
  name: string
  description: string
  run(round: RaceRound): Promise<void>
}
