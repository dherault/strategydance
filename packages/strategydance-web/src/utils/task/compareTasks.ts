import type { Task } from '~types'

// The order of a column, as `GetTasks` reads it: by position, then in the order the tasks were
// added, then by id, so two tabs sort a tie alike
function compareTasks(a: Task, b: Task) {
  if (a.position !== b.position) return a.position - b.position
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export default compareTasks
