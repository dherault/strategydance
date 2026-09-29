import { defineMessages } from 'react-intl'

// The checklist on the Today page: the habits a member ticks every day, which the team can read
const checklistMessages = defineMessages({
  title: {
    id: 'checklist.title',
    defaultMessage: 'Checklist',
    description: 'Title of the section of the Today page holding the habits a member ticks every day.',
  },
  description: {
    id: 'checklist.description',
    defaultMessage: 'Stay consistent',
    description: 'Line under the title of the checklist section.',
  },
  showFor: {
    id: 'checklist.showFor',
    defaultMessage: 'Show checklist for',
    description: 'Accessible label of the picker choosing whose checklist the section shows.',
  },
  day: {
    id: 'checklist.day',
    defaultMessage: 'Day',
    description: 'Heading of the checklist\'s first column, which lists the days.',
  },
  today: {
    id: 'checklist.today',
    defaultMessage: 'Today',
    description: 'Badge on the checklist row of the current day.',
  },
  addItem: {
    id: 'checklist.addItem',
    defaultMessage: 'Add task',
    description: 'Accessible label and tooltip of the button that adds a column, a habit, to the reader\'s checklist.',
  },
  newItemName: {
    id: 'checklist.newItemName',
    defaultMessage: 'New task',
    description: 'Name a new checklist column starts with, which the reader is invited to change straight away.',
  },
  itemHint: {
    id: 'checklist.itemHint',
    defaultMessage: '{name}: click to edit, drag to reorder',
    description: 'Tooltip of a column\'s slanted name in the reader\'s own checklist.',
  },
  editItem: {
    id: 'checklist.editItem',
    defaultMessage: 'Edit {name}',
    description: 'Accessible name of the popover in which the reader renames, moves or removes a checklist column.',
  },
  itemName: {
    id: 'checklist.itemName',
    defaultMessage: 'Task name',
    description: 'Label of the field in which the reader renames a checklist column.',
  },
  moveLeft: {
    id: 'checklist.moveLeft',
    defaultMessage: 'Move left',
    description: 'Button that moves a checklist column one place to the left.',
  },
  moveRight: {
    id: 'checklist.moveRight',
    defaultMessage: 'Move right',
    description: 'Button that moves a checklist column one place to the right.',
  },
  remove: {
    id: 'checklist.remove',
    defaultMessage: 'Remove',
    description: 'Button that removes a column from the reader\'s checklist. It asks for a second click.',
  },
  confirm: {
    id: 'checklist.confirm',
    defaultMessage: 'Confirm?',
    description: 'What the remove button of a checklist column says after a first click, asking for a second.',
  },
  save: {
    id: 'checklist.save',
    defaultMessage: 'Save',
    description: 'Button that saves a checklist column\'s new name.',
  },
  removed: {
    id: 'checklist.removed',
    defaultMessage: 'Removed {name}',
    description: 'Notification after the reader removed a column from their checklist, beside a button that takes it back.',
  },
  undo: {
    id: 'checklist.undo',
    defaultMessage: 'Undo',
    description: 'Button in a notification that takes back the removal it announces.',
  },
  cell: {
    id: 'checklist.cell',
    defaultMessage: '{name}, {day}',
    description: 'Accessible label of a checklist cell the reader can tick: the habit, then the day, such as "Talk to users, Friday, September 25".',
  },
  cellDone: {
    id: 'checklist.cellDone',
    defaultMessage: '{name}, {day}: done',
    description: 'Accessible label of a checklist cell that is ticked and cannot be changed.',
  },
  cellNotDone: {
    id: 'checklist.cellNotDone',
    defaultMessage: '{name}, {day}: not done',
    description: 'Accessible label of a checklist cell that is not ticked and cannot be changed.',
  },
  unlockDay: {
    id: 'checklist.unlockDay',
    defaultMessage: 'Unlock {day}',
    description: 'Accessible label of the button that lets the reader tick a past day on their checklist.',
  },
  lockDay: {
    id: 'checklist.lockDay',
    defaultMessage: 'Lock {day}',
    description: 'Accessible label of the button that locks a past day of the checklist again.',
  },
  unlockHint: {
    id: 'checklist.unlockHint',
    defaultMessage: 'Unlock to edit',
    description: 'Tooltip of the lock beside a past day of the reader\'s checklist.',
  },
  lockHint: {
    id: 'checklist.lockHint',
    defaultMessage: 'Lock day',
    description: 'Tooltip of the open lock beside a past day the reader unlocked.',
  },
  showAll: {
    id: 'checklist.showAll',
    defaultMessage: 'Show all {count} days',
    description: 'Button under the checklist that unfolds it to every day since it started.',
  },
  showLess: {
    id: 'checklist.showLess',
    defaultMessage: 'Show less',
    description: 'Button under the unfolded checklist that folds it back to the last week.',
  },
  noItems: {
    id: 'checklist.noItems',
    defaultMessage: 'No tasks on this checklist.',
    description: 'What a checklist with no columns says, as a teammate\'s may.',
  },
  defaultReflexion: {
    id: 'checklist.defaultReflexion',
    defaultMessage: 'Reflexion',
    description: 'Name of the first habit every checklist starts with: time spent thinking the company over. Keep it short: it is read slanted above a narrow column.',
  },
  defaultTalkToUsers: {
    id: 'checklist.defaultTalkToUsers',
    defaultMessage: 'Talk to users',
    description: 'Name of the second habit every checklist starts with. Keep it short: it is read slanted above a narrow column.',
  },
  defaultDistribution: {
    id: 'checklist.defaultDistribution',
    defaultMessage: 'Distribution',
    description: 'Name of the third habit every checklist starts with: getting the product in front of people. Keep it short: it is read slanted above a narrow column.',
  },
  defaultBuilding: {
    id: 'checklist.defaultBuilding',
    defaultMessage: 'Building',
    description: 'Name of the fourth habit every checklist starts with: making the product. Keep it short: it is read slanted above a narrow column.',
  },
  loadError: {
    id: 'checklist.loadError',
    defaultMessage: 'The checklist could not be loaded.',
    description: 'Error shown in place of the checklist when it could not be read.',
  },
  historyError: {
    id: 'checklist.historyError',
    defaultMessage: 'The earlier days could not be loaded. Try again.',
    description: 'Error shown when unfolding the checklist failed to read the days before the last week.',
  },
  saveError: {
    id: 'checklist.saveError',
    defaultMessage: 'Your change to your checklist could not be saved. Try again.',
    description: 'Error shown when ticking, adding, renaming, moving or removing on the checklist failed.',
  },
})

export default checklistMessages
