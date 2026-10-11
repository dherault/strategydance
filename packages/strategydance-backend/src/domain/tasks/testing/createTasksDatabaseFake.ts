import { MAX_TASK_DEPENDENCIES, MAX_TASKS } from 'strategydance-core'

import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'

/*
  The backend connector's Tasks module operations, over tables kept in memory, added to a module
  database fake's base, which `createModuleDatabaseFake` builds with every module's, for the modules'
  tests. Each operation mirrors the conditions of its namesake in the connector, in the same order, and
  throws the same messages, so a test reads as the behaviour it checks. `check:tasks-module` checks
  those conditions against the emulators, which is what keeps the two alike: change one with the
  other. A pattern matches as near as a test needs, which that script checks against Postgres' own
*/

export type FakeTask = {
  id: string
  organizationId: string
  createdById: string | null
  name: string
  description: string
  descriptionText: string | null
  status: string
  position: number
  assigneeId: string | null
  isAssignedToAgent: boolean
  dueDate: string | null
  aspects: string[]
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FakeTaskDependency = {
  taskId: string
  dependencyId: string
}

const DAY_MS = 24 * 60 * 60 * 1000

// A task's name as `CreateTask` holds it: 1 to 120 characters on one line, no space at either end
const NAME_PATTERN = /^\S(?:.*\S)?$/u

function createTasksDatabaseFake<Base extends ModuleDatabaseFakeBase>(base: Base) {
  const { stamp, id, isMember, membersOf, membershipOf, matchesLike, insertResult, storeResult, checkKey } = base
  const tasks = new Map<string, FakeTask>()
  const dependencies: FakeTaskDependency[] = []

  // Declared here rather than read off the base, so a call narrows what follows it
  function refuse(message: string): never {
    throw new Error(message)
  }

  // A task written straight into its table, as a page would have stored it
  function insertTask(fields: Partial<FakeTask> & { organizationId: string }) {
    const time = stamp()
    const task: FakeTask = {
      id: id(crypto.randomUUID()),
      createdById: null,
      name: 'Task',
      description: '',
      descriptionText: '',
      status: 'TODO',
      position: tasks.size + 1,
      assigneeId: null,
      isAssignedToAgent: false,
      dueDate: null,
      aspects: [],
      deletedAt: null,
      createdAt: time,
      updatedAt: time,
      ...fields,
    }

    task.id = id(task.id)
    task.organizationId = id(task.organizationId)
    tasks.set(task.id, task)

    return task
  }

  // A link written straight into its table, as the page's `AddTaskDependency` would have
  function link(taskId: string, dependencyId: string) {
    if (!isLinked(taskId, dependencyId)) dependencies.push({ taskId: id(taskId), dependencyId: id(dependencyId) })
  }

  // A member's change of a task's fields through one of the page's operations, which moves `updatedAt`
  function changeTask(taskId: string, fields: Partial<FakeTask>) {
    const task = tasks.get(id(taskId))

    if (!task) refuse('No task by that id')

    Object.assign(task, fields, { updatedAt: stamp() })

    return task
  }

  function isLinked(taskId: unknown, dependencyId: unknown) {
    return dependencies.some(
      dependency => dependency.taskId === id(taskId) && dependency.dependencyId === id(dependencyId),
    )
  }

  function isLive(task: FakeTask | undefined, organizationId: unknown): task is FakeTask {
    return task !== undefined && task.organizationId === id(organizationId) && task.deletedAt === null
  }

  function liveTasks(organizationId: unknown) {
    return [...tasks.values()].filter(task => isLive(task, organizationId))
  }

  // The order `GetTasks` reads a column in, which every list of tasks here keeps
  function byPosition(a: FakeTask, b: FakeTask) {
    if (a.position !== b.position) return a.position - b.position
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1

    return a.id < b.id ? -1 : 1
  }

  function liveDependencyIds(task: FakeTask) {
    return dependencies
      .filter(dependency => dependency.taskId === task.id && tasks.get(dependency.dependencyId)?.deletedAt === null)
      .map(({ dependencyId }) => dependencyId)
  }

  function pruneDeleted(organizationId?: unknown) {
    let deleted = 0

    for (const task of tasks.values()) {
      const isOrganizations = organizationId === undefined || task.organizationId === id(organizationId)

      if (isOrganizations && task.deletedAt !== null && Date.parse(task.deletedAt) < Date.now() - DAY_MS) {
        tasks.delete(task.id)
        dependencies.splice(
          0,
          dependencies.length,
          ...dependencies.filter(dependency => dependency.taskId !== task.id && dependency.dependencyId !== task.id),
        )
        deleted++
      }
    }

    return deleted
  }

  // Whether a variable was sent, as `has(vars.x)` reads it: one sent as null was
  function has(variables: AnyVariables, name: string) {
    return variables[name] !== undefined
  }

  function checkName(name: unknown) {
    if (typeof name !== 'string' || name.length > 120 || !NAME_PATTERN.test(name)) {
      refuse("A task's name is 1 to 120 characters on one line, with no space at either end")
    }
  }

  function checkAspects(aspects: unknown) {
    if (!Array.isArray(aspects) || new Set(aspects).size !== aspects.length) {
      refuse('A task is tagged with each aspect at most once')
    }
  }

  function checkAssignee(variables: AnyVariables) {
    if (variables.isAssignedToAgent === true && variables.assigneeId !== undefined && variables.assigneeId !== null) {
      refuse('A task is assigned to a member or to Strategy Dance, not both')
    }
  }

  function checkAssigneeMember(variables: AnyVariables) {
    const assigneeId = variables.assigneeId as string | null | undefined

    if (assigneeId && !membersOf(variables.organizationId).some(member => member.userId === assigneeId)) {
      refuse('A task is assigned to a member of its organization')
    }
  }

  // The organization's row taken as a lock, which finds nothing unless the caller is still the member
  function lock(variables: AnyVariables) {
    if (!isMember(variables)) refuse('The caller is no longer a member of the organization')
  }

  base.addOperations({
    GetTaskBoardForAgent: variables => {
      const isCaller = isMember(variables)

      return {
        membership: membershipOf(variables),
        members: isCaller
          ? membersOf(variables.organizationId)
              .slice(0, 100)
              .map(member => ({ userId: member.userId, user: { displayName: member.displayName } }))
          : [],
        tasks: isCaller
          ? liveTasks(variables.organizationId)
              .sort(byPosition)
              .slice(0, 1000)
              .map(task => ({
                id: task.id,
                name: task.name,
                status: task.status,
                position: task.position,
                assigneeId: task.assigneeId,
                isAssignedToAgent: task.isAssignedToAgent,
                dueDate: task.dueDate,
                aspects: task.aspects,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                dependencies: liveDependencyIds(task)
                  .slice(0, 50)
                  .map(dependencyId => ({ dependencyId })),
                linkCount: [{ _count: dependencies.filter(dependency => dependency.taskId === task.id).length }],
              }))
          : [],
      }
    },

    GetTaskForAgent: variables => {
      const task = tasks.get(id(variables.id))
      const isFound = isMember(variables) && task !== undefined && task.organizationId === id(variables.organizationId)

      return {
        membership: membershipOf(variables),
        tasks: isFound
          ? [
              {
                id: task.id,
                name: task.name,
                status: task.status,
                assigneeId: task.assigneeId,
                isAssignedToAgent: task.isAssignedToAgent,
                dueDate: task.dueDate,
                aspects: task.aspects,
                description: task.description,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                deletedAt: task.deletedAt,
                createdBy: task.createdById
                  ? {
                      id: task.createdById,
                      displayName:
                        membersOf(task.organizationId).find(member => member.userId === task.createdById)?.displayName
                        ?? null,
                    }
                  : null,
                dependencies: liveDependencyIds(task)
                  .slice(0, 50)
                  .map(dependencyId => ({ dependencyId })),
                dependents: dependencies
                  .filter(
                    dependency =>
                      dependency.dependencyId === task.id && tasks.get(dependency.taskId)?.deletedAt === null,
                  )
                  .slice(0, 1000)
                  .map(({ taskId }) => ({ taskId })),
              },
            ]
          : [],
      }
    },

    SearchTasksForAgent: variables => ({
      membership: membershipOf(variables),
      tasks: isMember(variables)
        ? liveTasks(variables.organizationId)
            .filter(
              task =>
                matchesLike(task.name, String(variables.pattern))
                || (task.descriptionText !== null && matchesLike(task.descriptionText, String(variables.pattern))),
            )
            .slice(0, 1000)
            .map(task => ({ id: task.id }))
        : [],
    }),

    GetUnindexedTasksForAgent: variables => ({
      membership: membershipOf(variables),
      tasks: isMember(variables)
        ? liveTasks(variables.organizationId)
            .filter(task => task.descriptionText === null)
            .slice(0, 21)
            .map(({ id: taskId, description, updatedAt }) => ({ id: taskId, description, updatedAt }))
        : [],
    }),

    GetUnindexedTasks: variables => {
      const skipped = new Set((variables.skippedIds as string[]).map(id))

      return {
        tasks: [...tasks.values()]
          .filter(task => task.descriptionText === null && !skipped.has(task.id))
          .slice(0, 100)
          .map(({ id: taskId, description, updatedAt }) => ({ id: taskId, description, updatedAt })),
      }
    },

    CreateTaskForAgent: variables => {
      lock(variables)
      checkKey(variables)
      checkName(variables.name)

      if (variables.description.length > 20000 || variables.descriptionText.length > 20000) {
        refuse("A task's description is at most 20000 characters")
      }

      checkAspects(variables.aspects)
      checkAssignee(variables)
      insertResult(variables)

      if (liveTasks(variables.organizationId).length >= MAX_TASKS) refuse('An organization keeps at most 1000 tasks')

      checkAssigneeMember(variables)

      if (tasks.has(id(variables.id))) refuse('violates SQL unique constraint: task_pkey (aborted)')

      storeResult(variables)
      insertTask({
        id: String(variables.id),
        organizationId: String(variables.organizationId),
        createdById: String(variables.userId),
        name: String(variables.name),
        description: String(variables.description),
        descriptionText: String(variables.descriptionText),
        status: String(variables.status),
        position: Number(variables.position),
        assigneeId: (variables.assigneeId as string | null | undefined) ?? null,
        isAssignedToAgent: Boolean(variables.isAssignedToAgent),
        dueDate: (variables.dueDate as string | null | undefined) ?? null,
        aspects: [...variables.aspects],
      })

      return { task_insert: { id: id(variables.id) } }
    },

    UpdateTaskForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)

      if (has(variables, 'name')) checkName(variables.name)

      if (
        (has(variables, 'description') && (variables.description === null || variables.description.length > 20000))
        || (has(variables, 'descriptionText')
          && variables.descriptionText !== null
          && variables.descriptionText.length > 20000)
      ) {
        refuse("A task's description is at most 20000 characters")
      }

      if (has(variables, 'aspects')) checkAspects(variables.aspects)
      if (has(variables, 'isAssignedToAgent')) checkAssignee(variables)

      checkAssigneeMember(variables)
      insertResult(variables)

      const task = tasks.get(id(variables.id))

      if (!isLive(task, variables.organizationId) || task.updatedAt !== variables.updatedAt) {
        refuse('The task changed or was deleted since it was read')
      }

      storeResult(variables)

      for (const field of [
        'name',
        'description',
        'descriptionText',
        'status',
        'position',
        'assigneeId',
        'isAssignedToAgent',
        'dueDate',
        'aspects',
      ] as const) {
        if (has(variables, field)) Object.assign(task, { [field]: variables[field] })
      }

      task.updatedAt = stamp()

      return { task_updateMany: 1 }
    },

    AddTaskDependencyForAgent: variables => {
      lock(variables)
      checkKey(variables)

      if (id(variables.taskId) === id(variables.dependencyId)) refuse('A task cannot wait on itself')

      insertResult(variables)

      if (!isLive(tasks.get(id(variables.taskId)), variables.organizationId)) {
        refuse('No task by that id in the organization')
      }

      if (!isLive(tasks.get(id(variables.dependencyId)), variables.organizationId)) {
        refuse('No task by that id in the organization')
      }

      if (isLinked(variables.dependencyId, variables.taskId)) refuse('A task cannot wait on a task that waits on it')

      const others = dependencies.filter(
        dependency =>
          dependency.taskId === id(variables.taskId) && dependency.dependencyId !== id(variables.dependencyId),
      )

      if (others.length >= MAX_TASK_DEPENDENCIES) refuse('A task waits on at most 50 others')

      storeResult(variables)
      link(String(variables.taskId), String(variables.dependencyId))

      return { taskDependency_upsert: { taskId: id(variables.taskId), dependencyId: id(variables.dependencyId) } }
    },

    RemoveTaskDependencyForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)

      const task = tasks.get(id(variables.taskId))

      if (
        !task
        || task.organizationId !== id(variables.organizationId)
        || !isLinked(variables.taskId, variables.dependencyId)
      ) {
        refuse('The task does not wait on that one')
      }

      storeResult(variables)
      dependencies.splice(
        0,
        dependencies.length,
        ...dependencies.filter(
          dependency =>
            dependency.taskId !== id(variables.taskId) || dependency.dependencyId !== id(variables.dependencyId),
        ),
      )

      return { taskDependency_deleteMany: 1 }
    },

    DeleteTaskForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)

      const task = tasks.get(id(variables.id))

      if (!isLive(task, variables.organizationId)) refuse('No task by that id in the organization')

      storeResult(variables)
      task.deletedAt = stamp()

      return { task_updateMany: 1, task_deleteMany: pruneDeleted(variables.organizationId) }
    },

    RestoreTaskForAgent: variables => {
      lock(variables)
      checkKey(variables)
      insertResult(variables)

      if (liveTasks(variables.organizationId).length >= MAX_TASKS) refuse('An organization keeps at most 1000 tasks')

      const task = tasks.get(id(variables.id))
      const isRestorable =
        task !== undefined
        && task.organizationId === id(variables.organizationId)
        && task.deletedAt !== null
        && Date.parse(task.deletedAt) > Date.now() - DAY_MS

      if (!isRestorable) refuse('The task is gone for good')

      storeResult(variables)
      task.deletedAt = null

      return { task_updateMany: 1 }
    },

    IndexTaskTextForAgent: variables => {
      const task = tasks.get(id(variables.id))
      const isIndexed =
        isMember(variables)
        && task !== undefined
        && task.organizationId === id(variables.organizationId)
        && task.updatedAt === variables.updatedAt
        && task.descriptionText === null

      if (isIndexed) task.descriptionText = String(variables.descriptionText)

      return { task_updateMany: isIndexed ? 1 : 0 }
    },

    IndexTaskText: variables => {
      const task = tasks.get(id(variables.id))
      const isIndexed = task !== undefined && task.updatedAt === variables.updatedAt && task.descriptionText === null

      if (isIndexed) task.descriptionText = String(variables.descriptionText)

      return { task_updateMany: isIndexed ? 1 : 0 }
    },

    PruneDeletedTasks: () => ({ task_deleteMany: pruneDeleted() }),
  })

  base.onReset(() => {
    tasks.clear()
    dependencies.length = 0
  })

  return Object.assign(base, { tasks, dependencies, insertTask, link, changeTask })
}

export type TasksDatabaseFake = ReturnType<typeof createTasksDatabaseFake<ModuleDatabaseFakeBase>>

export default createTasksDatabaseFake
