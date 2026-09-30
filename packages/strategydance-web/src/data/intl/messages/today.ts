import { defineMessages } from 'react-intl'

// The Today page: the team's top priorities, and what the page shows around its sections
const todayMessages = defineMessages({
  prioritiesTitle: {
    id: 'today.prioritiesTitle',
    defaultMessage: '{count, plural, one {Top priority} other {Top priorities}}',
    description:
      "Title of the section of the Today page showing the one thing each teammate is moving forward. Singular when only the reader's own is shown.",
  },
  prioritiesDescription: {
    id: 'today.prioritiesDescription',
    defaultMessage: 'Where your focus is',
    description: 'Line under the title of the top priorities section.',
  },
  arrangePriorities: {
    id: 'today.arrangePriorities',
    defaultMessage: 'Choose visible priorities',
    description:
      'Tooltip of the eye button in the top priorities section, which opens the dialog for choosing whose priorities show and in what order.',
  },
  arrangePrioritiesLabel: {
    id: 'today.arrangePrioritiesLabel',
    defaultMessage: 'Choose visible priorities ({visible} of {total} shown)',
    description:
      'Accessible label of the eye button in the top priorities section, counting the priorities shown out of the whole team.',
  },
  noJobTitle: {
    id: 'today.noJobTitle',
    defaultMessage: 'No role',
    description: "Placeholder under a teammate's name for somebody who has not said what they do in the company.",
  },
  setYourPriority: {
    id: 'today.setYourPriority',
    defaultMessage: 'Set your top priority',
    description: "Placeholder on the reader's own priority card before they have set one. Clicking the card sets it.",
  },
  noPriority: {
    id: 'today.noPriority',
    defaultMessage: 'No priority set',
    description: "Placeholder on a teammate's priority card when they have not set one.",
  },
  editPriority: {
    id: 'today.editPriority',
    defaultMessage: 'Edit',
    description:
      "Hint shown on the reader's own priority card when it is hovered or focused, since clicking it edits the priority.",
  },
  editPriorityLabel: {
    id: 'today.editPriorityLabel',
    defaultMessage: 'Edit your top priority',
    description:
      "Accessible name of the button laid over the reader's own priority card, which opens the dialog that edits it.",
  },
  priorityDialogTitle: {
    id: 'today.priorityDialogTitle',
    defaultMessage: 'Your top priority',
    description: 'Title of the dialog where the reader writes their top priority.',
  },
  priorityDialogDescription: {
    id: 'today.priorityDialogDescription',
    defaultMessage: "The one thing you're moving forward today. Your team sees it on their Today page.",
    description: 'Explanation under the title of the top priority dialog.',
  },
  priorityLabel: {
    id: 'today.priorityLabel',
    defaultMessage: 'Top priority',
    description: 'Label of the field in which the reader writes their top priority.',
  },
  priorityPlaceholder: {
    id: 'today.priorityPlaceholder',
    defaultMessage: 'Set pricing for the beta before Friday',
    description: 'Example shown in the empty top priority field.',
  },
  priorityLength: {
    id: 'today.priorityLength',
    defaultMessage: '{length}/{max}',
    description:
      'Counter under the top priority field, such as "42/500": the characters written out of the most allowed.',
  },
  prioritySaveHint: {
    id: 'today.prioritySaveHint',
    defaultMessage: '{shortcut} to save',
    description:
      'Hint under the top priority field, such as "⌘Enter to save": the keyboard shortcut that saves the priority, since Enter starts a new line. {shortcut} is the key combination.',
  },
  priorityUpdated: {
    id: 'today.priorityUpdated',
    defaultMessage: 'Top priority updated',
    description: 'Confirmation shown after the reader saved their top priority.',
  },
  priorityError: {
    id: 'today.priorityError',
    defaultMessage: 'Your top priority could not be saved. Try again.',
    description: 'Error shown in the top priority dialog when saving failed.',
  },
  visibilityDialogTitle: {
    id: 'today.visibilityDialogTitle',
    defaultMessage: 'Visible priorities',
    description:
      "Title of the dialog for choosing whose top priority shows on the reader's Today page, and in what order.",
  },
  visibilityDialogDescription: {
    id: 'today.visibilityDialogDescription',
    defaultMessage:
      'Choose whose top priority appears on your Today page and drag to reorder. This only changes your view.',
    description: 'Explanation under the title of the visible priorities dialog.',
  },
  visibleCount: {
    id: 'today.visibleCount',
    defaultMessage: '{visible} of {total} visible',
    description:
      'Summary at the bottom of the visible priorities dialog, counting the priorities shown out of the whole team.',
  },
  showPriority: {
    id: 'today.showPriority',
    defaultMessage: 'Show {name}',
    description: "Accessible label of the switch that shows or hides a teammate's priority on the reader's Today page.",
  },
  reorderPriority: {
    id: 'today.reorderPriority',
    defaultMessage: 'Reorder {name}, position {position} of {total}. Use arrow keys to move.',
    description: 'Accessible label of the drag handle beside a teammate in the visible priorities dialog.',
  },
  visibilityError: {
    id: 'today.visibilityError',
    defaultMessage: 'Your view of the priorities could not be saved. Try again.',
    description: 'Error shown when saving whose priorities show, and in what order, failed.',
  },
  prioritiesLoadError: {
    id: 'today.prioritiesLoadError',
    defaultMessage: "The team's priorities could not be loaded.",
    description: 'Error shown in place of the top priorities when they could not be read.',
  },
  viewOnly: {
    id: 'today.viewOnly',
    defaultMessage: 'View only',
    description:
      "Label beside a section of the Today page, the tasks or the checklist, when it shows a teammate's, which the reader can read but not change.",
  },
  retry: {
    id: 'today.retry',
    defaultMessage: 'Try again',
    description: 'Button beside an error on the Today page that reads the section again.',
  },
  done: {
    id: 'today.done',
    defaultMessage: 'Done',
    description: 'Button that closes a dialog on the Today page once the reader has made their choices.',
  },
  cancel: {
    id: 'today.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes a dialog on the Today page without saving.',
  },
  save: {
    id: 'today.save',
    defaultMessage: 'Save',
    description: 'Button that saves what the reader wrote in a dialog on the Today page.',
  },
  close: {
    id: 'today.close',
    defaultMessage: 'Close',
    description: 'Accessible label of the button that closes a dialog on the Today page.',
  },
})

export default todayMessages
