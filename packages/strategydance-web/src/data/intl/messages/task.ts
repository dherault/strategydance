import { defineMessages } from 'react-intl'

// The task lists on the Today page: the reader's own, and any teammate's, read only
const taskMessages = defineMessages({
  title: {
    id: 'task.title',
    defaultMessage: 'Tasks',
    description:
      "Title of the section of the Today page holding a member's task lists: the reader's own, or a teammate's.",
  },
  description: {
    id: 'task.description',
    defaultMessage: 'What you need to get done',
    description: 'Line under the title of the tasks section.',
  },
  showFor: {
    id: 'task.showFor',
    defaultMessage: 'Show tasks for',
    description: 'Accessible label of the picker choosing whose task lists the section shows.',
  },
  lists: {
    id: 'task.lists',
    defaultMessage: 'Task lists',
    description: 'Accessible name of the column listing the task lists the section shows.',
  },
  openCount: {
    id: 'task.openCount',
    defaultMessage: '{count} open',
    description: "Accessible label of the count beside a task list's name: how many of its tasks are not done yet.",
  },
  newList: {
    id: 'task.newList',
    defaultMessage: 'New list',
    description: 'Button that adds a task list.',
  },
  defaultListName: {
    id: 'task.defaultListName',
    defaultMessage: 'New list',
    description: 'Name a task list starts with, which the reader is invited to change straight away.',
  },
  noLists: {
    id: 'task.noLists',
    defaultMessage: 'No task lists yet.',
    description: 'What the tasks section says before the reader has made any task list.',
  },
  noMemberLists: {
    id: 'task.noMemberLists',
    defaultMessage: 'No task lists.',
    description: 'What the tasks section says when the teammate it shows has no task list.',
  },
  renameList: {
    id: 'task.renameList',
    defaultMessage: 'Rename list',
    description: "Tooltip of a task list's name, which becomes a field when clicked.",
  },
  listName: {
    id: 'task.listName',
    defaultMessage: 'List name',
    description: 'Accessible label of the field in which the reader renames a task list.',
  },
  deleteList: {
    id: 'task.deleteList',
    defaultMessage: 'Delete {name}',
    description: 'Accessible label of the button that deletes a task list and its tasks.',
  },
  deleteListTooltip: {
    id: 'task.deleteListTooltip',
    defaultMessage: 'Delete list',
    description: 'Tooltip of the button that deletes a task list.',
  },
  confirm: {
    id: 'task.confirm',
    defaultMessage: 'Confirm?',
    description:
      "Accessible name a task list's delete button takes after a first click, asking for a second to delete the list.",
  },
  openOfTotal: {
    id: 'task.openOfTotal',
    defaultMessage: '{open} of {total} open',
    description:
      'Summary beside a task list\'s name, such as "3 of 4 open": the tasks not done yet out of all its tasks.',
  },
  editTask: {
    id: 'task.editTask',
    defaultMessage: 'Edit task',
    description: "Tooltip of a task's text, which becomes a field when clicked.",
  },
  taskLabel: {
    id: 'task.taskLabel',
    defaultMessage: 'Task',
    description: 'Accessible label of the field in which the reader edits a task.',
  },
  markDone: {
    id: 'task.markDone',
    defaultMessage: 'Mark as done: {text}',
    description: 'Accessible label of the checkbox of a task that is not done.',
  },
  markNotDone: {
    id: 'task.markNotDone',
    defaultMessage: 'Mark as not done: {text}',
    description: 'Accessible label of the checkbox of a task that is done.',
  },
  deleteTask: {
    id: 'task.deleteTask',
    defaultMessage: 'Delete {text}',
    description: 'Accessible label of the button that deletes a task.',
  },
  deleteTaskTooltip: {
    id: 'task.deleteTaskTooltip',
    defaultMessage: 'Delete task',
    description: 'Tooltip of the button that deletes a task.',
  },
  reorderTask: {
    id: 'task.reorderTask',
    defaultMessage: 'Reorder {text}, position {position} of {total}. Use arrow keys to move.',
    description: 'Accessible label of the drag handle beside a task.',
  },
  addPlaceholder: {
    id: 'task.addPlaceholder',
    defaultMessage: 'Add a task',
    description: 'Placeholder of the field under a task list in which the reader types a new task.',
  },
  addLabel: {
    id: 'task.addLabel',
    defaultMessage: 'Add a task to {name}',
    description: 'Accessible label of the field in which the reader types a new task for a list.',
  },
  add: {
    id: 'task.add',
    defaultMessage: 'Add',
    description: 'Button that adds the task typed in the field beside it.',
  },
  listDeleted: {
    id: 'task.listDeleted',
    defaultMessage: 'Deleted {name}',
    description: 'Notification after the reader deleted a task list, beside a button that takes it back.',
  },
  taskDeleted: {
    id: 'task.taskDeleted',
    defaultMessage: 'Deleted task',
    description: 'Notification after the reader deleted a task, beside a button that takes it back.',
  },
  undo: {
    id: 'task.undo',
    defaultMessage: 'Undo',
    description: 'Button in a notification that takes back the delete it announces.',
  },
  loadError: {
    id: 'task.loadError',
    defaultMessage: 'The tasks could not be loaded.',
    description:
      "Error shown in place of the tasks section when the task lists or tasks it shows, the reader's own or a teammate's, could not be read.",
  },
  saveError: {
    id: 'task.saveError',
    defaultMessage: 'Your change to your tasks could not be saved. Try again.',
    description: 'Error shown when adding, changing, moving or deleting a task or a task list failed.',
  },
})

export default taskMessages
