import { parseArgs } from 'node:util'

import { dateDoneTask, getUndatedDoneTasks } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

/*
  Stamps when every task in Done was done, `Task.doneAt`, for those a release left without one, with
  their last change, the nearest the releases before it kept. Run by hand once the release that
  added it has deployed:

    bun run backfill:task-done-at --production   # the project, with Application Default Credentials
    DATA_CONNECT_EMULATOR_HOST=localhost:9399 bun run backfill:task-done-at   # the emulators

  It pages through the tasks still unstamped, 100 at a time, so it can stop at any point and start
  again where it left off: what it stamped stays stamped. Each is stamped only while it is still in
  Done and unstamped, so a finish landing in between keeps its own time, and a task moved out of
  Done meanwhile is left: either leaves the list, and one stamped neither way is left after a try,
  so a page never comes round forever. A task created straight into Done, or finished from a page
  from before `FinishTask`, is dated by its creation where nobody stamped it.

  It refuses to touch the project unless told to with `--production`
*/
const { values } = parseArgs({ args: process.argv.slice(2), options: { production: { type: 'boolean' } } })

if (!process.env.DATA_CONNECT_EMULATOR_HOST && !values.production) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set: pass --production to fill the project, or point this at the emulators',
  )
  process.exit(1)
}

const skippedIds: string[] = []
let stamped = 0

for (;;) {
  const { data } = await getUndatedDoneTasks(dataConnect, { skippedIds })

  if (data.tasks.length === 0) break

  for (const task of data.tasks) {
    const { data: written } = await dateDoneTask(dataConnect, { id: task.id, doneAt: task.updatedAt })

    if (written.task_updateMany === 1) stamped++
    else skippedIds.push(task.id)
  }

  console.log(`Stamped ${stamped} tasks so far`)
}

console.log(
  `Stamped ${stamped} tasks${skippedIds.length ? `, and left ${skippedIds.length} that changed meanwhile` : ''}`,
)

process.exit(0)
