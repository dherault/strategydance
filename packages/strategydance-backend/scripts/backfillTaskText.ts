import { parseArgs } from 'node:util'

import { getUnindexedTasks, indexTaskText } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import readTaskDescriptionText from '~domain/tasks/readTaskDescriptionText'

/*
  Fills the plain text the Tasks module's queries match, `Task.descriptionText`, of every task a
  release left without one, from its `description`, run by hand once the release that added it has
  deployed:

    bun run backfill:task-text --production   # the project, with Application Default Credentials
    DATA_CONNECT_EMULATOR_HOST=localhost:9399 bun run backfill:task-text   # the emulators

  It pages through the tasks still unindexed, 100 at a time, so it can stop at any point and start
  again where it left off: what it indexed stays indexed. Each is written only while the task is as
  it read it, so a save landing in between, which writes its own text or nulls it again, is never
  written over: that task comes round again in the next page, and one that keeps changing is left
  after three tries for a query to index when it next looks. No request ever carries this: a query
  indexes a few tasks itself before it reads the plain text, which is enough once this has run.

  It refuses to touch the project unless told to with `--production`
*/
const { values } = parseArgs({ args: process.argv.slice(2), options: { production: { type: 'boolean' } } })

if (!process.env.DATA_CONNECT_EMULATOR_HOST && !values.production) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set: pass --production to fill the project, or point this at the emulators',
  )
  process.exit(1)
}

// How many times a task that changed under every write is tried before it is left
const MAX_ATTEMPTS = 3

const attempts = new Map<string, number>()
const skippedIds: string[] = []
let indexed = 0

for (;;) {
  const { data } = await getUnindexedTasks(dataConnect, { skippedIds })

  if (data.tasks.length === 0) break

  for (const task of data.tasks) {
    const { data: written } = await indexTaskText(dataConnect, {
      id: task.id,
      updatedAt: task.updatedAt,
      descriptionText: readTaskDescriptionText(task.description),
    })

    if (written.task_updateMany === 1) {
      indexed++

      continue
    }

    const tried = (attempts.get(task.id) ?? 0) + 1

    attempts.set(task.id, tried)

    if (tried >= MAX_ATTEMPTS) skippedIds.push(task.id)
  }

  console.log(`Indexed ${indexed} tasks so far`)
}

console.log(`Indexed ${indexed} tasks${skippedIds.length ? `, and left ${skippedIds.length} that kept changing` : ''}`)

process.exit(0)
