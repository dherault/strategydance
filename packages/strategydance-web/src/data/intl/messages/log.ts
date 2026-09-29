import { defineMessages } from 'react-intl'

// The log on the Today page: what each member moved forward each day, as a feed the team reads
const logMessages = defineMessages({
  title: {
    id: 'log.title',
    defaultMessage: 'Log',
    description: 'Title of the section of the Today page where members write what moved forward each day.',
  },
  description: {
    id: 'log.description',
    defaultMessage: 'Your daily progress',
    description: 'Line under the title of the log section.',
  },
  placeholder: {
    id: 'log.placeholder',
    defaultMessage: 'What moved forward today?',
    description: "Placeholder of the editor in which the reader writes today's log entry.",
  },
  editPlaceholder: {
    id: 'log.editPlaceholder',
    defaultMessage: 'What moved forward?',
    description: 'Placeholder of the editor in which the reader rewrites one of their log entries.',
  },
  post: {
    id: 'log.post',
    defaultMessage: 'Post',
    description: "Button that posts the reader's log entry for today.",
  },
  save: {
    id: 'log.save',
    defaultMessage: 'Save',
    description: "Button that saves the reader's edit of a log entry.",
  },
  cancel: {
    id: 'log.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes the editor of a log entry without saving.',
  },
  postHint: {
    id: 'log.postHint',
    defaultMessage: '{shortcut} to post',
    description:
      'Hint under the log editor, such as "⌘Enter to post": the keyboard shortcut that posts the entry. {shortcut} is the key combination.',
  },
  saveHint: {
    id: 'log.saveHint',
    defaultMessage: '{shortcut} to save',
    description:
      'Hint under the editor of a log entry being edited, such as "⌘Enter to save". {shortcut} is the key combination.',
  },
  loggedToday: {
    id: 'log.loggedToday',
    defaultMessage: 'You logged today at {time}.',
    description:
      'What replaces the log editor once the reader has written today\'s entry, such as "You logged today at 10:12."',
  },
  loggedTodayNext: {
    id: 'log.loggedTodayNext',
    defaultMessage: "You can log again tomorrow, or edit today's entry.",
    description:
      'Line after "You logged today at…", saying one entry a day is the rule and today\'s can still be edited.',
  },
  posted: {
    id: 'log.posted',
    defaultMessage: 'Logged for today',
    description: "Confirmation shown after the reader posted today's log entry.",
  },
  updated: {
    id: 'log.updated',
    defaultMessage: 'Log entry updated',
    description: 'Confirmation shown after the reader saved an edit of a log entry.',
  },
  saveError: {
    id: 'log.saveError',
    defaultMessage: 'Your log entry could not be saved. Try again.',
    description: 'Error shown when posting or editing a log entry failed. What was written stays in the editor.',
  },
  edited: {
    id: 'log.edited',
    defaultMessage: 'Edited',
    description: 'Note beside the author of a log entry they changed after posting it.',
  },
  editEntry: {
    id: 'log.editEntry',
    defaultMessage: 'Edit log entry',
    description: "Accessible label of the pencil button on the reader's own log entries.",
  },
  today: {
    id: 'log.today',
    defaultMessage: 'Today',
    description: 'Separator above the log entries written today.',
  },
  yesterday: {
    id: 'log.yesterday',
    defaultMessage: 'Yesterday',
    description: 'Separator above the log entries written yesterday.',
  },
  empty: {
    id: 'log.empty',
    defaultMessage: 'Nothing logged this week yet.',
    description: 'What the log says when nobody in the organization wrote an entry in the last seven days.',
  },
  loadPrevious: {
    id: 'log.loadPrevious',
    defaultMessage: 'Load previous week',
    description: 'Button under the log that reads the week before the oldest one shown.',
  },
  loadError: {
    id: 'log.loadError',
    defaultMessage: 'The log could not be loaded.',
    description: 'Error shown in place of a week of the log when it could not be read.',
  },
  loadingEditor: {
    id: 'log.loadingEditor',
    defaultMessage: 'Loading editor',
    description: 'What shows in place of the log editor while its code loads.',
  },
  editorError: {
    id: 'log.editorError',
    defaultMessage: 'The editor could not load. Check your connection and reload.',
    description: 'What shows in place of the log editor when its code failed to load.',
  },
  toolbar: {
    id: 'log.toolbar',
    defaultMessage: 'Formatting',
    description: "Accessible name of the log editor's toolbar of formatting buttons.",
  },
  bold: {
    id: 'log.bold',
    defaultMessage: 'Bold',
    description: "Button and tooltip of the log editor's toolbar that makes the selection bold.",
  },
  italic: {
    id: 'log.italic',
    defaultMessage: 'Italic',
    description: "Button and tooltip of the log editor's toolbar that makes the selection italic.",
  },
  underline: {
    id: 'log.underline',
    defaultMessage: 'Underline',
    description: "Button and tooltip of the log editor's toolbar that underlines the selection.",
  },
  strikethrough: {
    id: 'log.strikethrough',
    defaultMessage: 'Strikethrough',
    description: "Button and tooltip of the log editor's toolbar that strikes the selection through.",
  },
  heading: {
    id: 'log.heading',
    defaultMessage: 'Heading',
    description: "Button and tooltip of the log editor's toolbar that turns the paragraph into a heading.",
  },
  bulletedList: {
    id: 'log.bulletedList',
    defaultMessage: 'Bulleted list',
    description: "Button and tooltip of the log editor's toolbar that starts a list with bullets.",
  },
  numberedList: {
    id: 'log.numberedList',
    defaultMessage: 'Numbered list',
    description: "Button and tooltip of the log editor's toolbar that starts a numbered list.",
  },
  quote: {
    id: 'log.quote',
    defaultMessage: 'Quote',
    description: "Button and tooltip of the log editor's toolbar that turns the paragraph into a quote.",
  },
  undo: {
    id: 'log.undo',
    defaultMessage: 'Undo',
    description: "Button and tooltip of the log editor's toolbar that undoes the last change.",
  },
  redo: {
    id: 'log.redo',
    defaultMessage: 'Redo',
    description: "Button and tooltip of the log editor's toolbar that redoes the change just undone.",
  },
})

export default logMessages
