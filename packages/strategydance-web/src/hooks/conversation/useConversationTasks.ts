import type { Task } from '~types'

import useTasks from '~hooks/task/useTasks'

/*
  The organization's board as a conversation's thread looks its tasks up, by id, kept live, so a
  link to one draws its current name and a deleted one is gone from it at once. Read only once the
  thread `needs` it, and null until it has landed, or when it could not be read, when the thread
  draws what the agent wrote and decides nothing. The board leaves deleted tasks out, so an id it
  lacks names one deleted, pruned or never there
*/
function useConversationTasks(needs: boolean): ReadonlyMap<string, Task> | null {
  const { data, initialLoading, hasFailed } = useTasks({ isEnabled: needs })

  if (!needs || initialLoading || hasFailed) return null

  return new Map(data.map(task => [task.id.replaceAll('-', '').toLowerCase(), task]))
}

export default useConversationTasks
