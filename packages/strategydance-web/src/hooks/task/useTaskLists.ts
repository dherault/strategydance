import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import {
  type GetTaskListsData,
  type GetTasksData,
  createTaskList as createTaskListMutation,
  deleteTaskList as deleteTaskListMutation,
  getMemberTaskListsRef,
  getTaskListsRef,
  moveTaskList as moveTaskListMutation,
  renameTaskList as renameTaskListMutation,
  restoreTaskList as restoreTaskListMutation,
} from 'strategydance-database/web'

import type { DataSource, TaskList } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import recordActivity from '~utils/activity/recordActivity'
import getPositionBetween from '~utils/common/getPositionBetween'
import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

const EMPTY_TASK_LISTS: TaskList[] = []

/*
  A member's task lists in the current organization, the reader's own or a teammate's, and what
  changes them: only the reader's own changes, which the server holds to as well. The reader's own
  are read keyed by the token, and a teammate's by their uid, through the query any member may call.

  Every change lands in the cache first, so the rail follows at once, and is sent after, queued
  behind any earlier change to the same list: see `writeOptimistically`. When the server refuses
  one, the lists are read again, so the rail shows what is really there, and the error goes back
  to the caller to say so.

  A move writes the one list that moved, halfway between its new neighbours, unless those are too
  close for a float to fit between, when the rail is renumbered one list at a time, as `useTasks`
  moves a task.

  It does not retry on mount, and a failed read is `hasFailed` rather than no lists: `TodayWait`
  waits on the reader's own
*/
function useTaskLists(userId: string | null): DataSource<TaskList[]> & {
  hasFailed: boolean
  createTaskList: (id: string, name: string) => Promise<void>
  renameTaskList: (id: string, name: string) => Promise<void>
  deleteTaskList: (id: string) => Promise<void>
  restoreTaskList: (taskList: TaskList, index: number) => Promise<void>
  moveTaskList: (from: number, to: number) => Promise<void>
} {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const isOwn = userId === (viewer?.uid ?? null)
  // The key names whose lists they are: the tab's cache outlives a sign-out, and the next account
  // in the same organization must not open on this one's lists
  const queryKey = ['GetTaskLists', organizationId, userId]
  const isEnabled = Boolean(organizationId && userId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: taskLists } = await executeQuery(
        isOwn
          ? getTaskListsRef(dataConnect, { organizationId: organizationId! })
          : getMemberTaskListsRef(dataConnect, { organizationId: organizationId!, userId: userId! }),
      )

      return taskLists
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  const taskLists = data?.taskLists ?? EMPTY_TASK_LISTS

  function setTaskLists(update: (taskLists: TaskList[]) => TaskList[]) {
    queryClient.setQueryData<GetTaskListsData>(
      queryKey,
      current => current && { ...current, taskLists: update(current.taskLists) },
    )
  }

  // A change that goes through marks the day active, for the reader's streak
  function change(taskListId: string, apply: () => void, write: () => Promise<unknown>) {
    return writeOptimistically({
      queryClient,
      queryKeys: [queryKey],
      rowKey: `taskList:${taskListId}`,
      apply,
      write: () => write().then(() => recordActivity(organizationId!)),
    })
  }

  // The id is the caller's, which opens the list before the server has answered. It goes last
  function createTaskList(id: string, name: string) {
    const position = getPositionBetween(taskLists.at(-1)?.position ?? null, null)!

    return change(
      id,
      () => {
        setTaskLists(current => [...current, { id, name, position, openTasks: [{ _count: 0 }] }])
        // A new list has no tasks, so there is nothing to wait for when it opens
        queryClient.setQueryData<GetTasksData>(['GetTasks', organizationId, userId, id], { tasks: [] })
      },
      () => createTaskListMutation(dataConnect, { organizationId: organizationId!, id, name, position }),
    )
  }

  function renameTaskList(id: string, name: string) {
    return change(
      id,
      () => setTaskLists(current => current.map(taskList => (taskList.id === id ? { ...taskList, name } : taskList))),
      () => renameTaskListMutation(dataConnect, { organizationId: organizationId!, id, name }),
    )
  }

  function deleteTaskList(id: string) {
    return change(
      id,
      () => setTaskLists(current => current.filter(taskList => taskList.id !== id)),
      () => deleteTaskListMutation(dataConnect, { organizationId: organizationId!, id }),
    )
  }

  // Puts a deleted list back where it was, its tasks with it
  function restoreTaskList(taskList: TaskList, index: number) {
    return change(
      taskList.id,
      () => setTaskLists(current => [...current.slice(0, index), taskList, ...current.slice(index)]),
      () => restoreTaskListMutation(dataConnect, { organizationId: organizationId!, id: taskList.id }),
    )
  }

  function write(taskList: TaskList) {
    return () =>
      moveTaskListMutation(dataConnect, {
        organizationId: organizationId!,
        id: taskList.id,
        position: taskList.position,
      })
  }

  async function moveTaskList(from: number, to: number) {
    const moved = taskLists[from]

    if (!moved || from === to) return

    const reordered = taskLists.filter((_, index) => index !== from)

    reordered.splice(to, 0, moved)

    const position = getPositionBetween(reordered[to - 1]?.position ?? null, reordered[to + 1]?.position ?? null)

    if (position !== null) {
      const taskList = { ...moved, position }

      await change(
        taskList.id,
        () => setTaskLists(() => reordered.map(item => (item.id === taskList.id ? taskList : item))),
        write(taskList),
      )

      return
    }

    // No room left between the two, as there never is between two lists made before lists could
    // move: every list takes a whole position again, the rail landing in the cache at once and each
    // list that moved written on its own
    const renumbered = reordered.map((item, index) => ({ ...item, position: index + 1 }))
    const changed = renumbered.filter((item, index) => item.position !== reordered[index]!.position)

    await Promise.all(
      changed.map((item, index) =>
        change(item.id, index === 0 ? () => setTaskLists(() => renumbered) : () => {}, write(item)),
      ),
    )
  }

  return {
    data: taskLists,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
    createTaskList,
    renameTaskList,
    deleteTaskList,
    restoreTaskList,
    moveTaskList,
  }
}

export default useTaskLists
