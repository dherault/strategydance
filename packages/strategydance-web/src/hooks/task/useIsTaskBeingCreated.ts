import { useSyncExternalStore } from 'react'

import { readIsTaskBeingCreated, subscribeToTaskCreations } from '~data/taskCreations'

/*
  Whether the reader created this task and the server has not stored it yet, which
  `useTaskChanges` says. Nothing is being created while the document shell is prerendered
*/
function useIsTaskBeingCreated(taskId: string) {
  return useSyncExternalStore(
    subscribeToTaskCreations,
    () => readIsTaskBeingCreated(taskId),
    () => false,
  )
}

export default useIsTaskBeingCreated
