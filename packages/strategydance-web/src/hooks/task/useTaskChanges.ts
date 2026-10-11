import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import {
  type CompanyAspect,
  type GetTaskDescriptionData,
  type GetTaskDescriptionsData,
  type GetTasksData,
  type TaskStatus,
  addTaskDependency as addTaskDependencyMutation,
  assignTask as assignTaskMutation,
  createTaskWithText as createTaskMutation,
  deleteTask as deleteTaskMutation,
  getTasksRef,
  moveTask as moveTaskMutation,
  removeTaskDependency as removeTaskDependencyMutation,
  renameTask as renameTaskMutation,
  restoreTask as restoreTaskMutation,
  updateTaskAspects as updateTaskAspectsMutation,
  updateTaskDescriptionWithText as updateTaskDescriptionMutation,
  updateTaskDueDate as updateTaskDueDateMutation,
} from 'strategydance-database/web'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'

import type { Task, TaskDraft, TaskSnapshot } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import recordActivity from '~utils/activity/recordActivity'
import createId from '~utils/common/createId'
import writeOptimistically from '~utils/common/writeOptimistically'
import compareTasks from '~utils/task/compareTasks'
import getTaskDependents from '~utils/task/getTaskDependents'
import getTaskLinkCount from '~utils/task/getTaskLinkCount'
import getTaskLoopingDependents from '~utils/task/getTaskLoopingDependents'
import getTaskMovePosition from '~utils/task/getTaskMovePosition'
import getTaskRestoreLoops from '~utils/task/getTaskRestoreLoops'

import { dataConnect } from '~data/firebase'

type Change = {
  // The row it writes, whose writes queue behind each other
  rowKey: string
  // The rows it waits for, such as the two tasks a link joins
  after?: string[]
  // The queries it shows in, the board's unless it says otherwise
  queryKeys?: QueryKey[]
  apply: () => void
  write: () => Promise<unknown>
}

/*
  Everything a member changes on the current organization's board, each change landing in the
  board's cache, and the descriptions' where it touches one, before it is sent.

  Each task's writes are queued behind each other, and a link's behind both its tasks', so a task
  created with links reaches the server before they do, and a delete and its Undo arrive in the
  order they were made: see `writeOptimistically`. When the server refuses one, the board is read
  again and the promise rejects, for the caller to say so. One that goes through marks the day
  active, for the reader's streak.

  A move writes the one task that moved, halfway between its new neighbours, unless those are too
  close for a float to fit between, when its column is renumbered one task at a time
*/
function useTaskChanges() {
  const queryClient = useQueryClient()
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const tasksKey = ['GetTasks', organizationId]
  const descriptionsKey = ['GetTaskDescriptions', organizationId]

  function readTasks() {
    return queryClient.getQueryData<GetTasksData>(tasksKey)?.tasks ?? []
  }

  // Keeps the board in its columns' order, as `GetTasks` reads it
  function setTasks(update: (tasks: Task[]) => Task[]) {
    queryClient.setQueryData<GetTasksData>(
      tasksKey,
      current => current && { ...current, tasks: [...update(current.tasks)].sort(compareTasks) },
    )
  }

  function updateTask(taskId: string, update: (task: Task) => Task) {
    setTasks(tasks => tasks.map(task => (task.id === taskId ? update(task) : task)))
  }

  function getDescriptionKey(taskId: string) {
    return ['GetTaskDescription', organizationId, taskId]
  }

  // In the board's descriptions and the task's own. Null takes it out, as a deleted task's is
  function setDescription(taskId: string, description: string | null) {
    queryClient.setQueryData<GetTaskDescriptionData>(
      getDescriptionKey(taskId),
      current => current && { ...current, tasks: description === null ? [] : [{ id: taskId, description }] },
    )
    queryClient.setQueryData<GetTaskDescriptionsData>(
      descriptionsKey,
      current =>
        current && {
          ...current,
          tasks: [
            ...current.tasks.filter(({ id }) => id !== taskId),
            ...(description === null ? [] : [{ id: taskId, description }]),
          ],
        },
    )
  }

  function change({ rowKey, after, queryKeys = [tasksKey], apply, write }: Change) {
    return writeOptimistically({
      queryClient,
      queryKeys,
      rowKey,
      after,
      apply,
      write: () => write().then(() => recordActivity(organizationId!)),
    })
  }

  function changeTask(taskId: string, update: (task: Task) => Task, write: () => Promise<unknown>) {
    return change({ rowKey: `task:${taskId}`, apply: () => updateTask(taskId, update), write })
  }

  // Makes `taskId` wait on `dependencyId`, once whatever `waitFor` names has reached the server
  function linkTasks(taskId: string, dependencyId: string, waitFor: string[] = []) {
    return change({
      rowKey: `taskDependency:${taskId}:${dependencyId}`,
      after: [`task:${taskId}`, `task:${dependencyId}`, ...waitFor],
      apply: () =>
        updateTask(taskId, task =>
          task.dependencies.some(link => link.dependencyId === dependencyId)
            ? task
            : {
                ...task,
                dependencies: [...task.dependencies, { dependencyId }],
                linkCount: [{ _count: getTaskLinkCount(task) + 1 }],
              },
        ),
      write: () => addTaskDependencyMutation(dataConnect, { organizationId: organizationId!, taskId, dependencyId }),
    })
  }

  function unlinkTasks(taskId: string, dependencyId: string) {
    return change({
      rowKey: `taskDependency:${taskId}:${dependencyId}`,
      after: [`task:${taskId}`, `task:${dependencyId}`],
      apply: () =>
        updateTask(taskId, task =>
          task.dependencies.some(link => link.dependencyId === dependencyId)
            ? {
                ...task,
                dependencies: task.dependencies.filter(link => link.dependencyId !== dependencyId),
                linkCount: [{ _count: Math.max(0, getTaskLinkCount(task) - 1) }],
              }
            : task,
        ),
      write: () => removeTaskDependencyMutation(dataConnect, { organizationId: organizationId!, taskId, dependencyId }),
    })
  }

  // Adds a task past the last of its column, then links it. Its id comes back at once, so the page
  // can point at it before the server has it
  function createTask(draft: TaskDraft) {
    const id = createId()
    const task: Task = {
      id,
      name: draft.name,
      status: draft.status,
      position: getTaskMovePosition(
        readTasks().filter(other => other.status === draft.status),
        null,
      )!,
      assigneeId: draft.assigneeId,
      isAssignedToAgent: draft.isAssignedToAgent,
      dueDate: draft.dueDate,
      aspects: draft.aspects,
      createdById: viewer?.uid ?? null,
      createdAt: new Date().toISOString(),
      dependencies: [],
      linkCount: [{ _count: 0 }],
    }
    const created = change({
      rowKey: `task:${id}`,
      queryKeys: [tasksKey, descriptionsKey],
      apply: () => {
        setTasks(tasks => [...tasks, task])
        setDescription(id, draft.description)
      },
      write: () =>
        createTaskMutation(dataConnect, {
          organizationId: organizationId!,
          id,
          name: task.name,
          description: draft.description,
          // With the plain text of its description, which agents' queries match
          descriptionText: getRichTextText(parseRichText(draft.description)),
          status: task.status,
          position: task.position,
          assigneeId: task.assigneeId,
          isAssignedToAgent: task.isAssignedToAgent,
          dueDate: task.dueDate,
          aspects: task.aspects,
        }),
    })
    const linked = [
      ...draft.dependencyIds.map(dependencyId => linkTasks(id, dependencyId)),
      ...draft.blockedIds.map(blockedId => linkTasks(blockedId, id)),
    ]

    return { id, written: Promise.all([created, ...linked]).then(() => undefined) }
  }

  function renameTask(taskId: string, name: string) {
    return changeTask(
      taskId,
      task => ({ ...task, name }),
      () => renameTaskMutation(dataConnect, { organizationId: organizationId!, id: taskId, name }),
    )
  }

  function updateTaskDescription(taskId: string, description: string) {
    return change({
      rowKey: `task:${taskId}`,
      queryKeys: [getDescriptionKey(taskId), descriptionsKey],
      apply: () => setDescription(taskId, description),
      write: () =>
        updateTaskDescriptionMutation(dataConnect, {
          organizationId: organizationId!,
          id: taskId,
          description,
          descriptionText: getRichTextText(parseRichText(description)),
        }),
    })
  }

  function assignTask(
    taskId: string,
    { assigneeId, isAssignedToAgent }: Pick<Task, 'assigneeId' | 'isAssignedToAgent'>,
  ) {
    return changeTask(
      taskId,
      task => ({ ...task, assigneeId, isAssignedToAgent }),
      // `assigneeId` is always sent, null included, since an omitted one would leave it as it was
      () =>
        assignTaskMutation(dataConnect, {
          organizationId: organizationId!,
          id: taskId,
          assigneeId: assigneeId ?? null,
          isAssignedToAgent,
        }),
    )
  }

  function updateTaskDueDate(taskId: string, dueDate: string | null) {
    return changeTask(
      taskId,
      task => ({ ...task, dueDate }),
      () => updateTaskDueDateMutation(dataConnect, { organizationId: organizationId!, id: taskId, dueDate }),
    )
  }

  function updateTaskAspects(taskId: string, aspects: CompanyAspect[]) {
    return changeTask(
      taskId,
      task => ({ ...task, aspects }),
      () => updateTaskAspectsMutation(dataConnect, { organizationId: organizationId!, id: taskId, aspects }),
    )
  }

  function placeTask(taskId: string, status: TaskStatus, position: number) {
    return changeTask(
      taskId,
      task => ({ ...task, status, position }),
      () => moveTaskMutation(dataConnect, { organizationId: organizationId!, id: taskId, status, position }),
    )
  }

  // Moves a task into a column, before the task `beforeId`, or past its last one when that is null.
  // Dropped where it already sits, it stays and nothing is written
  async function moveTask(taskId: string, status: TaskStatus, beforeId: string | null) {
    const tasks = readTasks()
    const moved = tasks.find(task => task.id === taskId)

    if (!moved || beforeId === taskId) return

    const column = tasks.filter(task => task.status === status && task.id !== taskId)
    const beforeIndex = beforeId === null ? -1 : column.findIndex(task => task.id === beforeId)
    const index = beforeIndex < 0 ? column.length : beforeIndex

    if (moved.status === status && tasks.filter(task => task.status === status).indexOf(moved) === index) return

    const position = getTaskMovePosition(column, beforeId)

    if (position !== null) {
      await placeTask(taskId, status, position)

      return
    }

    // No room left between the two: every task of the column takes a whole position again, each
    // one that changed written on its own
    const reordered = [...column]

    reordered.splice(index, 0, moved)

    await Promise.all(
      reordered.flatMap((task, order) =>
        task.id === taskId || task.position !== order + 1 ? [placeTask(task.id, status, order + 1)] : [],
      ),
    )
  }

  // What `restoreTask` needs to put a task back once it is deleted, read before the delete
  function takeTaskSnapshot(taskId: string): TaskSnapshot | null {
    const tasks = readTasks()
    const task = tasks.find(({ id }) => id === taskId)

    if (!task) return null

    const descriptions = queryClient.getQueryData<GetTaskDescriptionsData>(descriptionsKey)?.tasks ?? []

    return {
      task,
      description: descriptions.find(({ id }) => id === taskId)?.description ?? '',
      dependentIds: getTaskDependents(taskId, tasks).map(({ id }) => id),
    }
  }

  /*
    Takes a task off the board, and off the links of the tasks that waited on it, as the board reads
    a deleted task's links once the server has it.

    It reaches the server once the links to it still on their way have, both ways: the server
    refuses a link to a task already deleted, and an Undo could not bring back one never stored
  */
  function deleteTask({ task, dependentIds }: TaskSnapshot) {
    return change({
      rowKey: `task:${task.id}`,
      after: [
        ...task.dependencies.map(({ dependencyId }) => `taskDependency:${task.id}:${dependencyId}`),
        ...dependentIds.map(dependentId => `taskDependency:${dependentId}:${task.id}`),
      ],
      queryKeys: [tasksKey, descriptionsKey],
      apply: () => {
        setTasks(tasks =>
          tasks
            .filter(({ id }) => id !== task.id)
            .map(other =>
              dependentIds.includes(other.id)
                ? { ...other, dependencies: other.dependencies.filter(link => link.dependencyId !== task.id) }
                : other,
            ),
        )
        setDescription(task.id, null)
      },
      write: () => deleteTaskMutation(dataConnect, { organizationId: organizationId!, id: task.id }),
    })
  }

  /*
    Puts a deleted task back where it was, with the links that the server kept for it, but for any
    that would close a loop with a link made while it was gone: those are taken off once it is back.

    The board reads past every deleted task's links, so a task deleted alongside this one and
    brought back since can hold a link the snapshot never saw. Once this one is back, the board is
    read again as the server has it, and any link still closing a loop through it is taken off too
  */
  async function restoreTask(snapshot: TaskSnapshot) {
    const { task, description, dependentIds } = snapshot
    const loopingIds = getTaskRestoreLoops(snapshot, readTasks())
    const relinkedIds = dependentIds.filter(id => !loopingIds.includes(id))

    await Promise.all([
      change({
        rowKey: `task:${task.id}`,
        queryKeys: [tasksKey, descriptionsKey],
        apply: () => {
          setTasks(tasks => [
            ...tasks
              .filter(({ id }) => id !== task.id)
              .map(other =>
                relinkedIds.includes(other.id) && !other.dependencies.some(link => link.dependencyId === task.id)
                  ? { ...other, dependencies: [...other.dependencies, { dependencyId: task.id }] }
                  : other,
              ),
            task,
          ])
          setDescription(task.id, description)
        },
        write: () => restoreTaskMutation(dataConnect, { organizationId: organizationId!, id: task.id }),
      }),
      ...loopingIds.map(dependentId => unlinkTasks(dependentId, task.id)),
    ])

    const { data } = await executeQuery(getTasksRef(dataConnect, { organizationId: organizationId! }))

    await Promise.all(
      getTaskLoopingDependents(task.id, data.tasks).map(dependentId => unlinkTasks(dependentId, task.id)),
    )
  }

  /*
    Makes a task wait on exactly these tasks, removing and adding one link at a time. Every change
    shows at once, but the additions reach the server once the removals have, so swapping a link on
    a task that waits on as many as it may is never refused for counting the one going away
  */
  async function setTaskDependencies(taskId: string, dependencyIds: string[]) {
    const current =
      readTasks()
        .find(({ id }) => id === taskId)
        ?.dependencies.map(link => link.dependencyId) ?? []
    const removedIds = current.filter(id => !dependencyIds.includes(id))
    const removedKeys = removedIds.map(id => `taskDependency:${taskId}:${id}`)

    await Promise.all([
      ...removedIds.map(id => unlinkTasks(taskId, id)),
      ...dependencyIds.filter(id => !current.includes(id)).map(id => linkTasks(taskId, id, removedKeys)),
    ])
  }

  // Makes exactly these tasks wait on a task, its removals reaching the server before its additions
  // as `setTaskDependencies`' do
  async function setTaskBlocks(taskId: string, blockedIds: string[]) {
    const current = getTaskDependents(taskId, readTasks()).map(({ id }) => id)
    const removedIds = current.filter(id => !blockedIds.includes(id))
    const removedKeys = removedIds.map(id => `taskDependency:${id}:${taskId}`)

    await Promise.all([
      ...removedIds.map(id => unlinkTasks(id, taskId)),
      ...blockedIds.filter(id => !current.includes(id)).map(id => linkTasks(id, taskId, removedKeys)),
    ])
  }

  return {
    createTask,
    renameTask,
    updateTaskDescription,
    assignTask,
    updateTaskDueDate,
    updateTaskAspects,
    moveTask,
    takeTaskSnapshot,
    deleteTask,
    restoreTask,
    setTaskDependencies,
    setTaskBlocks,
  }
}

export default useTaskChanges
