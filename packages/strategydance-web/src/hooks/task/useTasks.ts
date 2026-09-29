import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import {
  type GetTaskListsData,
  type GetTasksData,
  createTask as createTaskMutation,
  deleteTask as deleteTaskMutation,
  getMemberTasksRef,
  getTasksRef,
  updateTask as updateTaskMutation,
} from 'strategydance-database/web'

import type { DataSource, Task } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import createId from '~utils/common/createId'
import getPositionBetween from '~utils/common/getPositionBetween'
import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

const EMPTY_TASKS: Task[] = []

/*
  One of a member's task lists, the reader's own or a teammate's, its tasks in their order, and what
  changes them: only the reader's own change. Null while no list is open. A teammate's are read by
  their uid, as `useTaskLists` reads their lists.

  Changes land in the cache first and are sent after, each queued behind the ones before it for the
  same task, so a delete and its Undo, or two quick moves, reach the server in the order they were
  made: see `writeOptimistically`. The list's open count in the rail follows every change that
  opens or closes a task. When the server refuses one, the tasks and the lists are read again.

  A move writes the one task that moved, halfway between its new neighbours, unless those are too
  close for a float to fit between, when the list is renumbered one task at a time
*/
function useTasks(
  userId: string | null,
  taskListId: string | null,
): DataSource<Task[]> & {
  hasFailed: boolean
  createTask: (text: string) => Promise<void>
  updateTask: (task: Task) => Promise<void>
  deleteTask: (task: Task) => Promise<void>
  restoreTask: (task: Task) => Promise<void>
  moveTask: (from: number, to: number) => Promise<void>
} {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const isOwn = userId === (viewer?.uid ?? null)
  // Keyed by the owner too, as the lists are, for the account that signs in next in this tab
  const queryKey = ['GetTasks', organizationId, userId, taskListId]
  const isEnabled = Boolean(organizationId && userId && taskListId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: tasks } = await executeQuery(
        isOwn
          ? getTasksRef(dataConnect, { organizationId: organizationId!, taskListId: taskListId! })
          : getMemberTasksRef(dataConnect, {
              organizationId: organizationId!,
              userId: userId!,
              taskListId: taskListId!,
            }),
      )

      return tasks
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  const tasks = data?.tasks ?? EMPTY_TASKS
  const taskListsQueryKey = ['GetTaskLists', organizationId, userId]

  function setTasks(update: (current: Task[]) => Task[]) {
    queryClient.setQueryData<GetTasksData>(queryKey, current => current && { ...current, tasks: update(current.tasks) })
  }

  // The pill beside the list's name in the rail
  function shiftOpenCount(delta: number) {
    if (!delta) return

    queryClient.setQueryData<GetTaskListsData>(
      taskListsQueryKey,
      current =>
        current && {
          ...current,
          taskLists: current.taskLists.map(taskList =>
            taskList.id === taskListId
              ? { ...taskList, openTasks: [{ _count: Math.max(0, (taskList.openTasks[0]?._count ?? 0) + delta) }] }
              : taskList,
          ),
        },
    )
  }

  // Behind whatever its list has queued, so a task added to a list just created, or edited on a
  // list just brought back, reaches the server once the list is there
  function change(taskId: string, apply: () => void, write: () => Promise<unknown>) {
    return writeOptimistically({
      queryClient,
      queryKeys: [queryKey, taskListsQueryKey],
      rowKey: `task:${taskId}`,
      after: [`taskList:${taskListId}`],
      apply,
      write,
    })
  }

  function write(task: Task) {
    return () =>
      updateTaskMutation(dataConnect, {
        organizationId: organizationId!,
        id: task.id,
        text: task.text,
        isDone: task.isDone,
        position: task.position,
      })
  }

  function insert(task: Task) {
    return () =>
      createTaskMutation(dataConnect, {
        organizationId: organizationId!,
        id: task.id,
        taskListId: taskListId!,
        text: task.text,
        position: task.position,
        isDone: task.isDone,
      })
  }

  function createTask(text: string) {
    const last = tasks.at(-1)
    const task: Task = {
      id: createId(),
      text,
      isDone: false,
      position: getPositionBetween(last?.position ?? null, null)!,
    }

    return change(
      task.id,
      () => {
        setTasks(current => [...current, task])
        shiftOpenCount(1)
      },
      insert(task),
    )
  }

  function updateTask(task: Task) {
    const previous = tasks.find(({ id }) => id === task.id)

    return change(
      task.id,
      () => {
        setTasks(current => current.map(item => (item.id === task.id ? task : item)))
        if (previous && previous.isDone !== task.isDone) shiftOpenCount(task.isDone ? -1 : 1)
      },
      write(task),
    )
  }

  function deleteTask(task: Task) {
    return change(
      task.id,
      () => {
        setTasks(current => current.filter(({ id }) => id !== task.id))
        if (!task.isDone) shiftOpenCount(-1)
      },
      () => deleteTaskMutation(dataConnect, { organizationId: organizationId!, id: task.id }),
    )
  }

  // Puts a deleted task back where it was, by its position, as the same row
  function restoreTask(task: Task) {
    return change(
      task.id,
      () => {
        setTasks(current => [...current, task].sort((a, b) => a.position - b.position))
        if (!task.isDone) shiftOpenCount(1)
      },
      insert(task),
    )
  }

  async function moveTask(from: number, to: number) {
    const moved = tasks[from]

    if (!moved || from === to) return

    const reordered = tasks.filter((_, index) => index !== from)

    reordered.splice(to, 0, moved)

    const position = getPositionBetween(reordered[to - 1]?.position ?? null, reordered[to + 1]?.position ?? null)

    if (position !== null) {
      const task = { ...moved, position }

      await change(
        task.id,
        () => setTasks(() => reordered.map(item => (item.id === task.id ? task : item))),
        write(task),
      )

      return
    }

    // No room left between the two: every task takes a whole position again, the list landing in
    // the cache at once and each task that moved written on its own
    const renumbered = reordered.map((item, index) => ({ ...item, position: index + 1 }))
    const changed = renumbered.filter((item, index) => item.position !== reordered[index]!.position)

    await Promise.all(
      changed.map((item, index) =>
        change(item.id, index === 0 ? () => setTasks(() => renumbered) : () => {}, write(item)),
      ),
    )
  }

  return {
    data: tasks,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    moveTask,
  }
}

export default useTasks
