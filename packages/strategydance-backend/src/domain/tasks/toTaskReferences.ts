import type { BoardTask, TaskReference } from '~types'

import compareTaskPlaces from '~domain/tasks/compareTaskPlaces'

// Tasks of the board by id, in the board's order, each as its id and name, the first `limit` of them,
// with how many there are in all. An id the board does not hold, a task deleted meanwhile, is left out
function toTaskReferences(ids: Iterable<string>, tasksById: ReadonlyMap<string, BoardTask>, limit: number) {
  const tasks = [...new Set(ids)].flatMap(id => tasksById.get(id) ?? []).sort(compareTaskPlaces)

  return {
    tasks: tasks.slice(0, limit).map(({ id, name }): TaskReference => ({ id, name })),
    count: tasks.length,
  }
}

export default toTaskReferences
