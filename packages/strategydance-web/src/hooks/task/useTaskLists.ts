import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import {
  type GetTaskListsData,
  type GetTasksData,
  createTaskList as createTaskListMutation,
  deleteTaskList as deleteTaskListMutation,
  getTaskListsRef,
  renameTaskList as renameTaskListMutation,
  restoreTaskList as restoreTaskListMutation,
} from 'strategydance-database/web'

import type { DataSource, TaskList } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

const EMPTY_TASK_LISTS: TaskList[] = []

/*
  The reader's task lists in the current organization, which are theirs alone, and what changes
  them.

  Every change lands in the cache first, so the rail follows at once, and is sent after, queued
  behind any earlier change to the same list: see `writeOptimistically`. When the server refuses
  one, the lists are read again, so the rail shows what is really there, and the error goes back
  to the caller to say so.

  It does not retry on mount, and a failed read is `hasFailed` rather than no lists: `TodayWait`
  waits on it
*/
function useTaskLists(): DataSource<TaskList[]> & {
  hasFailed: boolean
  createTaskList: (id: string, name: string) => Promise<void>
  renameTaskList: (id: string, name: string) => Promise<void>
  deleteTaskList: (id: string) => Promise<void>
  restoreTaskList: (taskList: TaskList, index: number) => Promise<void>
} {
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const queryKey = ['GetTaskLists', organizationId]

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: taskLists } = await executeQuery(getTaskListsRef(dataConnect, { organizationId: organizationId! }))

      return taskLists
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  function setTaskLists(update: (taskLists: TaskList[]) => TaskList[]) {
    queryClient.setQueryData<GetTaskListsData>(queryKey, current => current && { ...current, taskLists: update(current.taskLists) })
  }

  function change(taskListId: string, apply: () => void, write: () => Promise<unknown>) {
    return writeOptimistically({ queryClient, queryKeys: [queryKey], rowKey: `taskList:${taskListId}`, apply, write })
  }

  // The id is the caller's, which opens the list before the server has answered
  function createTaskList(id: string, name: string) {
    return change(
      id,
      () => {
        setTaskLists(taskLists => [...taskLists, { id, name, openTasks: [{ _count: 0 }] }])
        // A new list has no tasks, so there is nothing to wait for when it opens
        queryClient.setQueryData<GetTasksData>(['GetTasks', organizationId, id], { tasks: [] })
      },
      () => createTaskListMutation(dataConnect, { organizationId: organizationId!, id, name }),
    )
  }

  function renameTaskList(id: string, name: string) {
    return change(
      id,
      () => setTaskLists(taskLists => taskLists.map(taskList => (taskList.id === id ? { ...taskList, name } : taskList))),
      () => renameTaskListMutation(dataConnect, { organizationId: organizationId!, id, name }),
    )
  }

  function deleteTaskList(id: string) {
    return change(
      id,
      () => setTaskLists(taskLists => taskLists.filter(taskList => taskList.id !== id)),
      () => deleteTaskListMutation(dataConnect, { organizationId: organizationId!, id }),
    )
  }

  // Puts a deleted list back where it was, its tasks with it
  function restoreTaskList(taskList: TaskList, index: number) {
    return change(
      taskList.id,
      () => setTaskLists(taskLists => [...taskLists.slice(0, index), taskList, ...taskLists.slice(index)]),
      () => restoreTaskListMutation(dataConnect, { organizationId: organizationId!, id: taskList.id }),
    )
  }

  return {
    data: data?.taskLists ?? EMPTY_TASK_LISTS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
    createTaskList,
    renameTaskList,
    deleteTaskList,
    restoreTaskList,
  }
}

export default useTaskLists
