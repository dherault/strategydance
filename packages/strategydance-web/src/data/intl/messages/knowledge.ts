import { defineMessages } from 'react-intl'

/*
  The organization's knowledge: the page that lists its documents, each document's own page, and
  the section of each aspect's page that shows the documents tagged with it. A document is called
  an item here, since it can be a note, a plan or a decision
*/
const knowledgeMessages = defineMessages({
  eyebrow: {
    id: 'knowledge.eyebrow',
    defaultMessage: 'What your company knows',
    description:
      'Small uppercase label above the title of the Knowledge page, which lists everything the team wrote down about its company.',
  },
  lead: {
    id: 'knowledge.lead',
    defaultMessage: '{count, plural, one {# item} other {# items}} across your aspects',
    description:
      'Line under the title of the Knowledge page: how many items of knowledge, such as notes, plans and decisions, the organization keeps, across the aspects of its company such as strategy or finances.',
  },
  add: {
    id: 'knowledge.add',
    defaultMessage: 'Add knowledge',
    description: 'Button that opens a new, empty item of knowledge, such as a note, a plan or a decision, to write.',
  },
  emptyTitle: {
    id: 'knowledge.emptyTitle',
    defaultMessage: 'No knowledge yet',
    description: 'Title of what the Knowledge page shows while the organization has written nothing down.',
  },
  emptyText: {
    id: 'knowledge.emptyText',
    defaultMessage:
      'Add notes, plans and decisions about your company. Tag each item with aspects so it shows up on those pages.',
    description:
      "Line under the title of the Knowledge page's empty state. Aspects are the parts of a company, such as strategy or finances, each with a page of its own.",
  },
  loadError: {
    id: 'knowledge.loadError',
    defaultMessage: 'Your knowledge could not be loaded. Check your connection and try again.',
    description: 'What the Knowledge page shows in place of its items when they could not be read.',
  },
  documentLoadError: {
    id: 'knowledge.documentLoadError',
    defaultMessage: 'This item could not be loaded. Check your connection and try again.',
    description: 'What the page of one item of knowledge shows when the item could not be read.',
  },
  retry: {
    id: 'knowledge.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the knowledge again after it failed to load.',
  },
  untitled: {
    id: 'knowledge.untitled',
    defaultMessage: 'Untitled',
    description:
      "What an item of knowledge is called while it has no title, on its card and as its title field's placeholder.",
  },
  editedJustNow: {
    id: 'knowledge.editedJustNow',
    defaultMessage: 'Edited just now',
    description:
      'When an item of knowledge last changed, on its card and its page, when that was less than a minute ago.',
  },
  editedAgo: {
    id: 'knowledge.editedAgo',
    defaultMessage: 'Edited {time}',
    description:
      'When an item of knowledge last changed, on its card and its page. {time} is a relative time from the browser, such as "5 minutes ago", "yesterday" or "3 days ago".',
  },
  editedOn: {
    id: 'knowledge.editedOn',
    defaultMessage: 'Edited {date}',
    description:
      'When an item of knowledge last changed, on its card and its page, when that was over a week ago. {date} is a short date, such as "Sep 3".',
  },
  allKnowledge: {
    id: 'knowledge.allKnowledge',
    defaultMessage: 'All knowledge',
    description:
      "Link to the page that lists every item of the organization's knowledge, from one item's page or an aspect's page.",
  },
  draft: {
    id: 'knowledge.draft',
    defaultMessage: 'Not saved until you add a title or content',
    description: 'Note at the top of a new item of knowledge, which is only kept once something is written in it.',
  },
  saving: {
    id: 'knowledge.saving',
    defaultMessage: 'Saving…',
    description: "Note at the top of an item of knowledge's page while what was just written is being saved.",
  },
  notSaved: {
    id: 'knowledge.notSaved',
    defaultMessage: 'Not saved',
    description: "Note at the top of an item of knowledge's page when what was written could not be saved yet.",
  },
  saveError: {
    id: 'knowledge.saveError',
    defaultMessage: 'Your changes could not be saved. They will be sent again with your next change.',
    description: 'Notification when what was written in an item of knowledge could not be saved.',
  },
  deletedElsewhere: {
    id: 'knowledge.deletedElsewhere',
    defaultMessage: 'Somebody deleted this item. What is written here is no longer saved.',
    description:
      'Message on an item of knowledge that a teammate deleted while the reader had it open, which the reader can no longer change.',
  },
  addFull: {
    id: 'knowledge.addFull',
    defaultMessage: 'Your organization keeps at most {max, number} items of knowledge. Delete one to add another.',
    description:
      'Notification when adding an item of knowledge to an organization that already keeps as many as it may.',
  },
  draftFull: {
    id: 'knowledge.draftFull',
    defaultMessage:
      'This item cannot be saved: your organization keeps at most {max, number} items of knowledge. Delete one, and it saves with your next change.',
    description:
      'Message on a new item of knowledge that cannot be stored because the organization already keeps as many items as it may.',
  },
  tooLong: {
    id: 'knowledge.tooLong',
    defaultMessage: 'This item is too long to save. Shorten it to keep your changes.',
    description: 'Message on an item of knowledge whose text grew past what can be saved.',
  },
  titleLabel: {
    id: 'knowledge.titleLabel',
    defaultMessage: 'Title',
    description: "Accessible name of an item of knowledge's title field.",
  },
  bodyLabel: {
    id: 'knowledge.bodyLabel',
    defaultMessage: 'Content',
    description: "Accessible name of an item of knowledge's text, under its title.",
  },
  bodyPlaceholder: {
    id: 'knowledge.bodyPlaceholder',
    defaultMessage: 'Start writing',
    description: "Placeholder of an item of knowledge's empty text, under its title.",
  },
  loadingEditor: {
    id: 'knowledge.loadingEditor',
    defaultMessage: 'Loading editor',
    description: "What shows in place of an item of knowledge's text editor while its code loads.",
  },
  editorError: {
    id: 'knowledge.editorError',
    defaultMessage: 'The editor could not load. Check your connection and reload.',
    description: "What shows in place of an item of knowledge's text editor when its code failed to load.",
  },
  editorTurnInto: {
    id: 'knowledge.editorTurnInto',
    defaultMessage: 'Turn into',
    description:
      "Item of the rich text editor's block menu, opened from the handle beside a block, leading to a list of block types the block can become: paragraph, heading, quote, list.",
  },
  addAspects: {
    id: 'knowledge.addAspects',
    defaultMessage: 'Add aspects',
    description:
      'Button under the title of an item of knowledge that has no aspects yet, which opens the list of aspects to tag it with. Aspects are the parts of a company, such as strategy or finances.',
  },
  editAspects: {
    id: 'knowledge.editAspects',
    defaultMessage: 'Edit aspects: {aspects}',
    description:
      "Accessible name of the button under an item of knowledge's title that shows the icons of the aspects it is tagged with and opens the list to change them. {aspects} lists their names.",
  },
  aspectsTitle: {
    id: 'knowledge.aspectsTitle',
    defaultMessage: 'Aspects',
    description:
      'Title of the dialog that tags an item of knowledge with aspects of the company, such as strategy or finances.',
  },
  aspectsDescription: {
    id: 'knowledge.aspectsDescription',
    defaultMessage: 'It shows up on the page of each aspect it is tagged with.',
    description:
      'Line under the title of the dialog that tags an item of knowledge with aspects of the company, saying where a tagged item appears.',
  },
  aspectsSelected: {
    id: 'knowledge.aspectsSelected',
    defaultMessage: '{count} selected',
    description: 'How many aspects are picked, at the bottom of the dialog that tags an item of knowledge with them.',
  },
  cancel: {
    id: 'knowledge.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes the aspects dialog without changing the item of knowledge.',
  },
  save: {
    id: 'knowledge.save',
    defaultMessage: 'Save',
    description: 'Button that tags the item of knowledge with the aspects picked in the dialog.',
  },
  close: {
    id: 'knowledge.close',
    defaultMessage: 'Close',
    description: 'Accessible name of the button that closes the aspects dialog.',
  },
  lock: {
    id: 'knowledge.lock',
    defaultMessage: 'Prevent AI modification',
    description:
      "Button under an item of knowledge's title, and its tooltip, that asks the product's AI agents never to change the item.",
  },
  unlock: {
    id: 'knowledge.unlock',
    defaultMessage: 'Allow AI modification',
    description:
      "Accessible name of the same button once the item is locked, which lets the product's AI agents change it again.",
  },
  lockedTooltip: {
    id: 'knowledge.lockedTooltip',
    defaultMessage: 'AI modification prevented. Click to allow.',
    description:
      "Tooltip of the lock button of an item of knowledge that the product's AI agents are asked not to change.",
  },
  locked: {
    id: 'knowledge.locked',
    defaultMessage: 'AI modification prevented',
    description: "Notification once an item of knowledge is locked against the product's AI agents.",
  },
  unlocked: {
    id: 'knowledge.unlocked',
    defaultMessage: 'AI can modify this item',
    description: "Notification once an item of knowledge is unlocked, so the product's AI agents may change it again.",
  },
  moreActions: {
    id: 'knowledge.moreActions',
    defaultMessage: 'More actions',
    description: "Accessible name of the button that opens an item of knowledge's menu, which holds Delete.",
  },
  delete: {
    id: 'knowledge.delete',
    defaultMessage: 'Delete',
    description: "Item of an item of knowledge's menu that deletes it.",
  },
  confirm: {
    id: 'knowledge.confirm',
    defaultMessage: 'Confirm?',
    description:
      'What the Delete item of the menu turns into after a first click, asking for a second to delete the item.',
  },
  deleted: {
    id: 'knowledge.deleted',
    defaultMessage: 'Deleted {title}',
    description: 'Notification once an item of knowledge is deleted. {title} is its title, or "Untitled".',
  },
  undo: {
    id: 'knowledge.undo',
    defaultMessage: 'Undo',
    description: 'Button in a notification that takes back the delete it announces.',
  },
  deleteError: {
    id: 'knowledge.deleteError',
    defaultMessage: 'The item could not be deleted. Try again.',
    description: 'Notification when an item of knowledge could not be deleted.',
  },
  restoreError: {
    id: 'knowledge.restoreError',
    defaultMessage: 'The item could not be brought back.',
    description: 'Notification when taking back the delete of an item of knowledge failed.',
  },
  aspectEmptyTitle: {
    id: 'knowledge.aspectEmptyTitle',
    defaultMessage: 'No knowledge for {aspect} yet',
    description:
      "Title of what the Knowledge section of an aspect's page shows while no item is tagged with that aspect. {aspect} is its name, such as Strategy.",
  },
  aspectEmptyText: {
    id: 'knowledge.aspectEmptyText',
    defaultMessage: 'Items tagged with {aspect} appear here.',
    description:
      "Line under the title of the empty Knowledge section of an aspect's page. {aspect} is the aspect's name, such as Strategy.",
  },
  leaveTitle: {
    id: 'knowledge.leaveTitle',
    defaultMessage: 'Leave without saving?',
    description:
      'Title of the dialog asked when leaving the page of an item of knowledge whose latest changes could not be saved.',
  },
  leaveText: {
    id: 'knowledge.leaveText',
    defaultMessage: 'Some of your changes could not be saved. If you leave now, they are lost.',
    description:
      'Line under the title of the dialog asked when leaving an item of knowledge with changes that could not be saved.',
  },
  stay: {
    id: 'knowledge.stay',
    defaultMessage: 'Stay',
    description: 'Button of the leave dialog that keeps the reader on the item of knowledge, with their changes.',
  },
  leave: {
    id: 'knowledge.leave',
    defaultMessage: 'Leave',
    description:
      'Button of the leave dialog that leaves the item of knowledge, giving up the changes that could not be saved.',
  },
  notFoundTitle: {
    id: 'knowledge.notFoundTitle',
    defaultMessage: 'This item no longer exists',
    description: 'Title of what the page of an item of knowledge shows when there is no such item.',
  },
  notFoundText: {
    id: 'knowledge.notFoundText',
    defaultMessage: 'It was deleted, or the link is out of date.',
    description: 'Line under the title of what the page of an item of knowledge shows when there is no such item.',
  },
  goToAll: {
    id: 'knowledge.goToAll',
    defaultMessage: 'Go to all knowledge',
    description: 'Button, on the page of an item of knowledge that no longer exists, to the list of every item.',
  },
})

export default knowledgeMessages
