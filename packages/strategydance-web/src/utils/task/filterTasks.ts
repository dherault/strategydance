import type { CompanyAspect } from 'strategydance-database/web'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

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
  // Each task's description, serialized, by its id
  descriptions: ReadonlyMap<string, string>
}

// The tasks the board's filters leave on it, in the order they came in
function filterTasks(
  tasks: readonly Task[],
  { query, assignee, aspects }: Filters,
  { viewerId, descriptions }: Context,
) {
  const words = query.trim().toLocaleLowerCase()

  return tasks.filter(task => {
    if (assignee === 'agent' && !task.isAssignedToAgent) return false
    if (assignee === 'me' && task.assigneeId !== viewerId) return false
    if (assignee !== 'all' && assignee !== 'agent' && assignee !== 'me' && task.assigneeId !== assignee) return false
    if (aspects.length && !task.aspects.some(aspect => aspects.includes(aspect))) return false
    if (!words) return true

    return (
      task.name.toLocaleLowerCase().includes(words)
      || getRichTextText(parseRichText(descriptions.get(task.id)))
        .toLocaleLowerCase()
        .includes(words)
    )
  })
}

export default filterTasks
