import { defineMessages } from 'react-intl'

/*
  The Tasks page: the organization's board of tasks in four columns, its filters, and the dialog a
  task opens in, where it is written, assigned, dated, tagged and linked to the tasks it waits on
*/
const taskMessages = defineMessages({
  eyebrow: {
    id: 'task.eyebrow',
    defaultMessage: 'Get to work',
    description: 'Small uppercase line above the title of the Tasks page, a blunt, cheeky nudge to start on the tasks.',
  },
  lead: {
    id: 'task.lead',
    defaultMessage: 'Work to be done by your team and Strategy Dance.',
    description:
      'Line under the title of the Tasks page, a board of the tasks the team works on. Strategy Dance is the product, which can be given tasks too.',
  },
  newTask: {
    id: 'task.newTask',
    defaultMessage: 'New task',
    description: 'Button that opens the dialog to add a task to the board.',
  },
  newTaskInColumn: {
    id: 'task.newTaskInColumn',
    defaultMessage: 'New task in {status}',
    description:
      'Accessible name of the plus button at the top of a column of the board, which adds a task to it. {status} is the column\'s name, such as "To do".',
  },
  loadError: {
    id: 'task.loadError',
    defaultMessage: 'The tasks could not be loaded.',
    description: 'Error shown in place of the board when its tasks failed to load.',
  },
  retry: {
    id: 'task.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the board again after it failed to load.',
  },
  emptyTitle: {
    id: 'task.emptyTitle',
    defaultMessage: 'No tasks yet',
    description: 'Title shown in place of the board while the organization has no task.',
  },
  emptyText: {
    id: 'task.emptyText',
    defaultMessage:
      'Add the work in front of you. Assign it to a teammate, or to Strategy Dance when it can do it for you.',
    description: 'Line under the title shown while the organization has no task. Strategy Dance is the product.',
  },
  searchPlaceholder: {
    id: 'task.searchPlaceholder',
    defaultMessage: 'Search tasks',
    description:
      "Placeholder and accessible name of the field that filters the board by the words in a task's name or description.",
  },
  assigneeFilterLabel: {
    id: 'task.assigneeFilterLabel',
    defaultMessage: 'Filter by assignee',
    description: 'Accessible name of the select that filters the board by who is doing each task.',
  },
  everyone: {
    id: 'task.everyone',
    defaultMessage: 'Everyone',
    description: "Option of the assignee filter that shows everybody's tasks.",
  },
  assignedToMe: {
    id: 'task.assignedToMe',
    defaultMessage: 'Assigned to me',
    description: "Option of the assignee filter that shows only the reader's own tasks.",
  },
  aspectsFilterPlaceholder: {
    id: 'task.aspectsFilterPlaceholder',
    defaultMessage: 'All aspects',
    description:
      'Placeholder of the select that filters the board by the aspects of the company tasks are about, such as Marketing, while none is picked.',
  },
  aspectsFilterLabel: {
    id: 'task.aspectsFilterLabel',
    defaultMessage: 'Filter by aspect',
    description: 'Accessible name of the select that filters the board by the aspects of the company tasks are about.',
  },
  searchAspects: {
    id: 'task.searchAspects',
    defaultMessage: 'Search aspects',
    description: 'Placeholder of the search field in the list of aspects of the company, such as Marketing or Legal.',
  },
  noAspectsFound: {
    id: 'task.noAspectsFound',
    defaultMessage: 'No aspects found',
    description: 'Shown in the list of aspects when its search matches none.',
  },
  clearFilters: {
    id: 'task.clearFilters',
    defaultMessage: 'Clear filters',
    description: "Button that resets the board's search and filters.",
  },
  statusBacklog: {
    id: 'task.statusBacklog',
    defaultMessage: 'Backlog',
    description: "Name of the board's first column, and of the status of a task nobody plans to start soon.",
  },
  statusTodo: {
    id: 'task.statusTodo',
    defaultMessage: 'To do',
    description: "Name of the board's second column, and of the status of a task planned but not started.",
  },
  statusOngoing: {
    id: 'task.statusOngoing',
    defaultMessage: 'Ongoing',
    description: "Name of the board's third column, and of the status of a task being worked on.",
  },
  statusDone: {
    id: 'task.statusDone',
    defaultMessage: 'Done',
    description: "Name of the board's last column, and of the status of a finished task.",
  },
  columnEmpty: {
    id: 'task.columnEmpty',
    defaultMessage: 'No tasks',
    description: 'Shown in a column of the board that holds no task.',
  },
  columnNoMatch: {
    id: 'task.columnNoMatch',
    defaultMessage: 'No matching tasks',
    description: "Shown in a column of the board where none of its tasks matches the board's search and filters.",
  },
  blockedBy: {
    id: 'task.blockedBy',
    defaultMessage: '{count, plural, one {Blocked by # task} other {Blocked by # tasks}}',
    description:
      'Tooltip and accessible name of the lock drawn on a task waiting on other tasks that are not done yet, saying how many.',
  },
  aspectsLabel: {
    id: 'task.aspectsLabel',
    defaultMessage: 'About {aspects}',
    description:
      'Accessible name of the aspect icons drawn on a task\'s card. {aspects} lists the aspects of the company it is about, as in "About Marketing, Product".',
  },
  moreAspects: {
    id: 'task.moreAspects',
    defaultMessage: '+{count}',
    description: "Drawn after a task's first aspect icon when it is about more than two aspects, counting the others.",
  },
  dueToday: {
    id: 'task.dueToday',
    defaultMessage: 'Today',
    description:
      'When a task is due, on its card and in its dialog, for a task due today. Also the button under the calendar that picks today.',
  },
  dueTomorrow: {
    id: 'task.dueTomorrow',
    defaultMessage: 'Tomorrow',
    description: 'When a task is due, on its card and in its dialog, for a task due tomorrow.',
  },
  dueYesterday: {
    id: 'task.dueYesterday',
    defaultMessage: 'Yesterday',
    description: 'When a task is due, on its card and in its dialog, for a task that was due yesterday.',
  },
  overdue: {
    id: 'task.overdue',
    defaultMessage: '{date} (overdue)',
    description:
      'When a task is due, in its dialog, for a task past that day and not done. {date} is the day, as in "Monday, October 12" or "Yesterday".',
  },
  noDate: {
    id: 'task.noDate',
    defaultMessage: 'No date',
    description: 'Shown in place of the day a task is due by while it has none, as a button that opens a calendar.',
  },
  changeDate: {
    id: 'task.changeDate',
    defaultMessage: 'Change the date',
    description: 'Tooltip of the button showing the day a task is due by, which opens a calendar.',
  },
  clearDate: {
    id: 'task.clearDate',
    defaultMessage: 'Clear',
    description: 'Button under the calendar that takes away the day a task is due by.',
  },
  completeBy: {
    id: 'task.completeBy',
    defaultMessage: 'Complete by',
    description: "Label of the day a task should be done by, in the task's dialog.",
  },
  status: {
    id: 'task.status',
    defaultMessage: 'Status',
    description: "Label of the select in a task's dialog that moves it between the board's columns.",
  },
  assignee: {
    id: 'task.assignee',
    defaultMessage: 'Assignee',
    description: "Label of the select in a task's dialog that says who is doing it.",
  },
  unassigned: {
    id: 'task.unassigned',
    defaultMessage: 'Unassigned',
    description: 'Option of the assignee select for a task nobody is doing.',
  },
  strategyDance: {
    id: 'task.strategyDance',
    defaultMessage: 'Strategy Dance',
    description:
      'The product, as the one doing a task: an option of the assignee select and of the assignee filter, and the name of its mark on a card. Keep the name as it is.',
  },
  memberYou: {
    id: 'task.memberYou',
    defaultMessage: '{name} - me',
    description:
      'The reader, among the members of the assignee select: their name, a plain hyphen and the word "me". {name} is their name.',
  },
  aspects: {
    id: 'task.aspects',
    defaultMessage: 'Aspects',
    description:
      "Label of the aspects of the company a task is about, such as Marketing or Legal, in the task's dialog.",
  },
  noAspects: {
    id: 'task.noAspects',
    defaultMessage: 'None',
    description: 'Shown in place of the aspects of a task that is about none, as a button that edits them.',
  },
  editAspects: {
    id: 'task.editAspects',
    defaultMessage: 'Edit the aspects',
    description: 'Tooltip of the button showing the aspects a task is about, which edits them.',
  },
  chooseAspects: {
    id: 'task.chooseAspects',
    defaultMessage: 'Choose aspects',
    description: 'Placeholder of the select that tags a task with aspects of the company, while none is picked.',
  },
  dependsOn: {
    id: 'task.dependsOn',
    defaultMessage: 'Depends on',
    description: "Title of the list of tasks that must be done before this one can start, in a task's dialog.",
  },
  blocks: {
    id: 'task.blocks',
    defaultMessage: 'Blocks',
    description: "Title of the list of tasks that wait on this one, in a task's dialog.",
  },
  editDependsOn: {
    id: 'task.editDependsOn',
    defaultMessage: 'Edit what this task depends on',
    description: 'Accessible name of the pencil button that picks the tasks this one waits on.',
  },
  editBlocks: {
    id: 'task.editBlocks',
    defaultMessage: 'Edit what this task blocks',
    description: 'Accessible name of the pencil button that picks the tasks that wait on this one.',
  },
  noLinks: {
    id: 'task.noLinks',
    defaultMessage: 'None',
    description: 'Shown under "Depends on" or "Blocks" in a task\'s dialog while it lists no task.',
  },
  chooseTasks: {
    id: 'task.chooseTasks',
    defaultMessage: 'Choose tasks',
    description:
      'Placeholder of the select that links a task to the tasks it waits on or blocks, while none is picked.',
  },
  searchTasks: {
    id: 'task.searchTasks',
    defaultMessage: 'Search tasks',
    description: 'Placeholder of the search field in the list that picks the tasks a task waits on or blocks.',
  },
  noTasksFound: {
    id: 'task.noTasksFound',
    defaultMessage: 'No tasks found',
    description: 'Shown in the list that picks tasks when its search matches none.',
  },
  clear: {
    id: 'task.clear',
    defaultMessage: 'Clear',
    description: 'Button at the bottom of a list of options that unpicks every one.',
  },
  close: {
    id: 'task.close',
    defaultMessage: 'Close',
    description: "Button that closes a task's dialog, or a list of options in it.",
  },
  moreChips: {
    id: 'task.moreChips',
    defaultMessage: '+{count} more',
    description: 'Drawn after the options a select shows, counting the ones it has no room for.',
  },
  description: {
    id: 'task.description',
    defaultMessage: 'Description',
    description: "Title of a task's description, in its dialog.",
  },
  addDescription: {
    id: 'task.addDescription',
    defaultMessage: 'Add a description',
    description: "Shown in place of a task's description while it has none, as a button that opens an editor.",
  },
  editDescription: {
    id: 'task.editDescription',
    defaultMessage: 'Edit the description',
    description: "Tooltip of a task's description, which opens an editor when clicked.",
  },
  descriptionPlaceholder: {
    id: 'task.descriptionPlaceholder',
    defaultMessage: 'What needs to happen, and what done looks like.',
    description: "Placeholder of the editor in which the reader writes a task's description.",
  },
  saveHint: {
    id: 'task.saveHint',
    defaultMessage: '{shortcut} to save',
    description: 'Hint under the description editor. {shortcut} is a key drawn as such, ⌘Enter or Ctrl+Enter.',
  },
  descriptionTooLong: {
    id: 'task.descriptionTooLong',
    defaultMessage: 'This description is too long to save.',
    description: "Error under the description editor when what was written runs past what a task's description holds.",
  },
  editorTurnInto: {
    id: 'task.editorTurnInto',
    defaultMessage: 'Turn into',
    description:
      "Item of the description editor's block menu that turns a paragraph into a heading, a list or a quote.",
  },
  loadingEditor: {
    id: 'task.loadingEditor',
    defaultMessage: 'Loading the editor…',
    description: 'Shown where the description editor will appear, while its code loads.',
  },
  editorError: {
    id: 'task.editorError',
    defaultMessage: 'The editor could not load. Reload the page to try again.',
    description: 'Shown in place of the description editor when its code failed to load.',
  },
  cancel: {
    id: 'task.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that leaves an edit without saving it, or closes the new task dialog without adding the task.',
  },
  save: {
    id: 'task.save',
    defaultMessage: 'Save',
    description: "Button that saves a task's description.",
  },
  namePlaceholder: {
    id: 'task.namePlaceholder',
    defaultMessage: 'Task name',
    description: "Placeholder and accessible name of the field holding a task's name.",
  },
  editName: {
    id: 'task.editName',
    defaultMessage: 'Edit the name',
    description: "Tooltip of a task's name at the top of its dialog, which turns into a field when clicked.",
  },
  nameRequired: {
    id: 'task.nameRequired',
    defaultMessage: 'Enter a name.',
    description: 'Error under the name of a new task when the reader tried to add it without one.',
  },
  newTaskDescription: {
    id: 'task.newTaskDescription',
    defaultMessage: 'Assign it to a teammate or to Strategy Dance.',
    description: 'Line under the title of the dialog that adds a task. Strategy Dance is the product.',
  },
  addedBy: {
    id: 'task.addedBy',
    defaultMessage: 'Added by {name} on {date}',
    description:
      'Line under a task\'s name in its dialog, saying who added it and when, as in "Added by Alex on October 9".',
  },
  addedOn: {
    id: 'task.addedOn',
    defaultMessage: 'Added on {date}',
    description: "Line under a task's name in its dialog, when whoever added it is no longer known.",
  },
  createTask: {
    id: 'task.createTask',
    defaultMessage: 'Create task',
    description: 'Button that adds the task the new task dialog describes to the board.',
  },
  deleteTask: {
    id: 'task.deleteTask',
    defaultMessage: 'Delete task',
    description: "Accessible name and tooltip of the button in a task's dialog that deletes it.",
  },
  confirmDelete: {
    id: 'task.confirmDelete',
    defaultMessage: 'Delete?',
    description: 'What the delete button says after a first click, asking for a second one to delete the task.',
  },
  deleted: {
    id: 'task.deleted',
    defaultMessage: 'Deleted {name}',
    description: "Notification after a task was deleted, with a button to take it back. {name} is the task's name.",
  },
  undo: {
    id: 'task.undo',
    defaultMessage: 'Undo',
    description: 'Button in the notification after a task was deleted, which brings it back.',
  },
  created: {
    id: 'task.created',
    defaultMessage: 'Task created',
    description: 'Notification after a task was added to the board, with a button that opens it.',
  },
  open: {
    id: 'task.open',
    defaultMessage: 'Open',
    description: 'Button in the notification after a task was added, which opens the task.',
  },
  canStartNow: {
    id: 'task.canStartNow',
    defaultMessage: '{name} can start now',
    description:
      'Notification after a task was moved to Done, naming the one task that was waiting on it and now waits on nothing else.',
  },
  tasksCanStartNow: {
    id: 'task.tasksCanStartNow',
    defaultMessage: '{count, plural, one {# task can start now} other {# tasks can start now}}',
    description:
      'Notification after a task was moved to Done, counting the tasks that were waiting on it and now wait on nothing else.',
  },
  saveError: {
    id: 'task.saveError',
    defaultMessage: 'The change could not be saved. Try again.',
    description: 'Notification when a change to a task did not reach the server, which puts the board back as it was.',
  },
})

export default taskMessages
