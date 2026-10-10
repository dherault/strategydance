import { MAX_TASK_DEPENDENCIES, MAX_TASK_DESCRIPTION_LENGTH, MAX_TASKS } from 'strategydance-core'

import type { TaskReference, TasksRefusal } from '~types'

import toToolRefusal from '~modules/toToolRefusal'

/*
  A refusal of the Tasks module, as the model reads it: what happened, in a sentence it can act on, by
  telling the member, reading the task again, or changing what it sent
*/
function toTasksRefusal(refusal: TasksRefusal) {
  return toToolRefusal(toSentence(refusal))
}

// Tasks as a refusal names them, each with its id, so the model can act on one
function toNames(tasks: readonly TaskReference[]) {
  return tasks.map(({ id, name }) => `"${name}" (${id})`).join(', ')
}

function toSentence(refusal: TasksRefusal) {
  switch (refusal.outcome) {
    case 'notMember':
      return 'The member is no longer in this organization, so its tasks are closed to you.'
    case 'readOnly':
      return 'This connection may only read tasks. Ask the member to connect again with write access to change them.'
    case 'notFound':
      return 'No task on the board has that id. List the tasks to find it: a deleted task is not on the board.'
    case 'assigneeNotMember':
      return 'That person is not a member of the organization. List the tasks to see the members, and name one as member:<id>.'
    case 'full':
      return `The board holds ${MAX_TASKS} tasks, the most it keeps. Tell the member, who can delete one first.`
    case 'changed':
      return "The task's description changed since you read it. Read it again first."
    case 'versionRequired':
      return 'Replacing a description takes the version read_task gave. Read the task first, then send its version.'
    case 'descriptionTooLong':
      return `That description is past ${MAX_TASK_DESCRIPTION_LENGTH} characters once stored, the most a task holds. Keep it to a short brief, and put the rest in a document.`
    case 'notInColumn':
      return 'beforeId names no task of the column status names. Name a task of that column, or leave beforeId out to move the task to its end.'
    case 'noRoom':
      return 'There is no room left between those two tasks. Move the task elsewhere in the column, or tell the member, whose next drag there makes room.'
    case 'busy':
      return 'The task kept changing while you changed it. Read it again, then try once more.'
    case 'selfDependency':
      return 'A task cannot wait on itself.'
    case 'loop':
      return `That link would close a loop of ${refusal.length} tasks, each waiting on the next and the last on the first: ${toNames(refusal.tasks)}${refusal.length > refusal.tasks.length ? ', and more' : ''}. Remove one of the links in it first, or leave this one out.`
    case 'tooManyDependencies':
      return `A task waits on at most ${MAX_TASK_DEPENDENCIES} others. Remove a link first.`
    case 'notLinked':
      return 'The task does not wait on that one, so there is no link to remove.'
    case 'notDeleted':
      return 'The task is not deleted, so there is nothing to restore.'
    case 'goneForGood':
      return 'The task was deleted over a day ago and is gone for good.'
    case 'restoreLoop':
      return `Restoring the task would close a loop through ${refusal.count} task${refusal.count === 1 ? '' : 's'} waiting on it: ${toNames(refusal.tasks)}${refusal.count > refusal.tasks.length ? ', and more' : ''}. Remove one of those links first, with remove_task_dependency naming that task and the deleted one.`
    case 'keyConflict':
      return 'That idempotency key was sent before with another call. Send a new key with each new call.'
    case 'invalidCursor':
      return 'That cursor is not one this tool gave. Start again without it.'
  }
}

export default toTasksRefusal
