import type { CompanyAspect } from 'strategydance-database/web'

import type { Task, TaskAssigneeFilter } from '~types'

type Filters = {
  // Words the task's name or its description holds, whatever their case
  query: string
  assignee: TaskAssigneeFilter
  // Any of these, or every task when there are none
  aspects: readonly CompanyAspect[]
}

type Context = {
  viewerId: string | null
  // Each task's description as words in lowercase, by its id, from `getTaskDescriptionTexts`
  descriptionTexts: ReadonlyMap<string, string>
}

// The tasks the board's filters leave on it, in the order they came in
function filterTasks(
  tasks: readonly Task[],
  { query, assignee, aspects }: Filters,
  { viewerId, descriptionTexts }: Context,
) {
  const words = query.trim().toLocaleLowerCase()

  return tasks.filter(task => {
    if (assignee === 'agent' && !task.isAssignedToAgent) return false
    if (assignee === 'me' && task.assigneeId !== viewerId) return false
    if (assignee.startsWith('member:') && task.assigneeId !== assignee.slice('member:'.length)) return false
    if (aspects.length && !task.aspects.some(aspect => aspects.includes(aspect))) return false
    if (!words) return true

    return task.name.toLocaleLowerCase().includes(words) || (descriptionTexts.get(task.id) ?? '').includes(words)
  })
}

export default filterTasks
