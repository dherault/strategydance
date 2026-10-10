import type { TaskStatus } from 'strategydance-database/backend'

import { TASK_STATUSES } from '~constants'

import toCanonicalUuid from '~utils/toCanonicalUuid'

// Where a task sits on the board: its column, its position in it, and, for a tie, when it was added
// and its id
export type TaskPlace = {
  status: `${TaskStatus}`
  position: number
  createdAt: string
  id: string
}

/*
  The board's order, as the page shows it: column by column, left to right, then by position, then
  in the order the tasks were added and by id, as `GetTasks` reads a column, so two tasks at one
  position always come in one order. An instant is compared to the microsecond, however many digits
  its fraction was written with, and an id as Postgres orders a UUID, by its hex digits
*/
function compareTaskPlaces(a: TaskPlace, b: TaskPlace) {
  const columns = TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status)

  if (columns !== 0) return columns
  if (a.position !== b.position) return a.position < b.position ? -1 : 1

  const aCreatedAt = toSortableInstant(a.createdAt)
  const bCreatedAt = toSortableInstant(b.createdAt)

  if (aCreatedAt !== bCreatedAt) return aCreatedAt < bCreatedAt ? -1 : 1

  const aId = toCanonicalUuid(a.id)
  const bId = toCanonicalUuid(b.id)

  return aId < bId ? -1 : aId > bId ? 1 : 0
}

// An instant written with its fraction to six digits, so two compare as strings as they do in time
function toSortableInstant(instant: string) {
  return instant.replace(/(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/, (_, fraction: string | undefined, zone: string) => {
    return `.${(fraction ?? '').padEnd(6, '0').slice(0, 6)}${zone}`
  })
}

export default compareTaskPlaces
