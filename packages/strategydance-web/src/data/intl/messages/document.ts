import { defineMessages } from 'react-intl'

/*
  The organization's documents: the page that lists them, each document's own page, and the
  section of each aspect's page that shows the documents tagged with it. A document can be a note,
  a plan or a decision
*/
const documentMessages = defineMessages({
  eyebrow: {
    id: 'document.eyebrow',
    defaultMessage: 'What you write, in one place',
    description:
      "Small uppercase line above the title of the Documents page, saying that the team's notes, plans and decisions are all kept there.",
  },
  lead: {
    id: 'document.lead',
    defaultMessage: '{count, plural, one {# document} other {# documents}} across your aspects',
    description:
      'Line under the title of the Documents page: how many documents, such as notes, plans and decisions, the organization keeps, across the aspects of its company such as strategy or finances.',
  },
  add: {
    id: 'document.add',
    defaultMessage: 'New document',
    description: 'Button that opens a new, empty document, such as a note, a plan or a decision, to write.',
  },
  emptyTitle: {
    id: 'document.emptyTitle',
    defaultMessage: 'No documents yet',
    description: 'Title of what the Documents page shows while the organization has written nothing down.',
  },
  emptyText: {
    id: 'document.emptyText',
    defaultMessage:
      'Add notes, plans and decisions about your company. Tag each document with aspects so it shows up on those pages.',
    description:
      "Line under the title of the Documents page's empty state. Aspects are the parts of a company, such as strategy or finances, each with a page of its own.",
  },
  searchPlaceholder: {
    id: 'document.searchPlaceholder',
    defaultMessage: 'Search documents',
    description:
      'Placeholder and accessible name of the field that filters the Documents page by the words in the titles of its documents, such as notes, plans and decisions.',
  },
  aspectsFilterPlaceholder: {
    id: 'document.aspectsFilterPlaceholder',
    defaultMessage: 'All aspects',
    description:
      'Placeholder of the select that filters the Documents page by the aspects of the company its documents are tagged with, such as Marketing, while none is picked.',
  },
  aspectsFilterLabel: {
    id: 'document.aspectsFilterLabel',
    defaultMessage: 'Filter by aspect',
    description:
      'Accessible name of the select that filters the Documents page by the aspects of the company its documents are tagged with.',
  },
  aspectsFilterSearch: {
    id: 'document.aspectsFilterSearch',
    defaultMessage: 'Search aspects',
    description:
      'Placeholder of the search field in the list of aspects of the company, such as Marketing or Legal, that filters the Documents page.',
  },
  aspectsFilterEmpty: {
    id: 'document.aspectsFilterEmpty',
    defaultMessage: 'No aspects found',
    description: 'Shown in the list of aspects that filters the Documents page when its search matches none.',
  },
  aspectsFilterClear: {
    id: 'document.aspectsFilterClear',
    defaultMessage: 'Clear',
    description:
      'Button at the bottom of the list of aspects that filters the Documents page, which unpicks every one.',
  },
  aspectsFilterClose: {
    id: 'document.aspectsFilterClose',
    defaultMessage: 'Close',
    description: 'Button at the bottom of the list of aspects that filters the Documents page, which closes the list.',
  },
  aspectsFilterMore: {
    id: 'document.aspectsFilterMore',
    defaultMessage: '+{count} more',
    description:
      'Drawn after the aspects the Documents page is filtered by, in the select that picks them, counting the ones it has no room to show.',
  },
  noMatchTitle: {
    id: 'document.noMatchTitle',
    defaultMessage: 'No document matches these filters',
    description:
      'Title of what the Documents page shows in place of its documents when none matches its search and aspect filter.',
  },
  noMatchText: {
    id: 'document.noMatchText',
    defaultMessage: 'Search looks at titles.',
    description:
      "Line under the title of what the Documents page shows when none of its documents matches, saying that its search reads only the documents' titles, not their text.",
  },
  clearFilters: {
    id: 'document.clearFilters',
    defaultMessage: 'Clear filters',
    description:
      "Button that resets the Documents page's search and aspect filter, shown when no document matches them.",
  },
  loadError: {
    id: 'document.loadError',
    defaultMessage: 'Your documents could not be loaded. Check your connection and try again.',
    description: 'What the Documents page shows in place of its documents when they could not be read.',
  },
  documentLoadError: {
    id: 'document.documentLoadError',
    defaultMessage: 'This document could not be loaded. Check your connection and try again.',
    description: 'What the page of one document shows when the document could not be read.',
  },
  retry: {
    id: 'document.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the documents again after it failed to load.',
  },
  untitled: {
    id: 'document.untitled',
    defaultMessage: 'Untitled',
    description: "What a document is called while it has no title, on its card and as its title field's placeholder.",
  },
  editedJustNow: {
    id: 'document.editedJustNow',
    defaultMessage: 'Edited just now',
    description: 'When a document last changed, on its card and its page, when that was less than a minute ago.',
  },
  editedAgo: {
    id: 'document.editedAgo',
    defaultMessage: 'Edited {time}',
    description:
      'When a document last changed, on its card and its page. {time} is a relative time from the browser, such as "5 minutes ago", "yesterday" or "3 days ago".',
  },
  editedOn: {
    id: 'document.editedOn',
    defaultMessage: 'Edited {date}',
    description:
      'When a document last changed, on its card and its page, when that was over a week ago. {date} is a short date, such as "Sep 3".',
  },
  allDocuments: {
    id: 'document.allDocuments',
    defaultMessage: 'All documents',
    description:
      "Link to the page that lists every document of the organization, from one document's page or an aspect's page.",
  },
  draft: {
    id: 'document.draft',
    defaultMessage: 'Not saved until you add a title or content',
    description: 'Note at the top of a new document, which is only kept once something is written in it.',
  },
  saving: {
    id: 'document.saving',
    defaultMessage: 'Saving…',
    description: "Note at the top of a document's page while what was just written is being saved.",
  },
  notSaved: {
    id: 'document.notSaved',
    defaultMessage: 'Not saved',
    description: "Note at the top of a document's page when what was written could not be saved yet.",
  },
  saveError: {
    id: 'document.saveError',
    defaultMessage: 'Your changes could not be saved. They will be sent again with your next change.',
    description: 'Notification when what was written in a document could not be saved.',
  },
  alsoHere: {
    id: 'document.alsoHere',
    defaultMessage: 'Also here: {names}',
    description:
      "Accessible name of the faces at the top of a document, one per teammate who has it open at the same time. {names} lists their names, as in 'Ana and Ben'.",
  },
  moreHere: {
    id: 'document.moreHere',
    defaultMessage: '+{count, number}',
    description:
      'Small round badge after the faces at the top of a document, counting the other teammates who have it open and have no face shown.',
  },
  deletedElsewhere: {
    id: 'document.deletedElsewhere',
    defaultMessage: 'Somebody deleted this document. What is written here is no longer saved.',
    description:
      'Message on a document that a teammate deleted while the reader had it open, which the reader can no longer change.',
  },
  addFull: {
    id: 'document.addFull',
    defaultMessage: 'Your organization keeps at most {max, number} documents. Delete one to add another.',
    description: 'Notification when adding a document to an organization that already keeps as many as it may.',
  },
  draftFull: {
    id: 'document.draftFull',
    defaultMessage:
      'This document cannot be saved: your organization keeps at most {max, number} documents. Delete one, and it saves with your next change.',
    description:
      'Message on a new document that cannot be stored because the organization already keeps as many documents as it may.',
  },
  tooLong: {
    id: 'document.tooLong',
    defaultMessage: 'This document is too long to save. Shorten it to keep your changes.',
    description: 'Message on a document whose text grew past what can be saved.',
  },
  titleLabel: {
    id: 'document.titleLabel',
    defaultMessage: 'Title',
    description: "Accessible name of a document's title field.",
  },
  bodyLabel: {
    id: 'document.bodyLabel',
    defaultMessage: 'Content',
    description: "Accessible name of a document's text, under its title.",
  },
  bodyPlaceholder: {
    id: 'document.bodyPlaceholder',
    defaultMessage: 'Start writing',
    description: "Placeholder of a document's empty text, under its title.",
  },
  loadingEditor: {
    id: 'document.loadingEditor',
    defaultMessage: 'Loading editor',
    description: "What shows in place of a document's text editor while its code loads.",
  },
  editorError: {
    id: 'document.editorError',
    defaultMessage: 'The editor could not load. Check your connection and reload.',
    description: "What shows in place of a document's text editor when its code failed to load.",
  },
  editorTurnInto: {
    id: 'document.editorTurnInto',
    defaultMessage: 'Turn into',
    description:
      "Item of the rich text editor's block menu, opened from the handle beside a block, leading to a list of block types the block can become: paragraph, heading, quote, list.",
  },
  editorVideoSubtext: {
    id: 'document.editorVideoSubtext',
    defaultMessage: 'A YouTube, Vimeo or Loom video',
    description:
      'Line under "Video" in the rich text editor\'s menu of blocks, opened by typing a slash. The block plays a video from one of these sites. Keep the site names as they are.',
  },
  editorVideoUnsupported: {
    id: 'document.editorVideoUnsupported',
    defaultMessage: 'Paste a link to a YouTube, Vimeo or Loom video',
    description:
      'Message under the field where the link of a video block is pasted, when the link is not to a video on one of these sites. Keep the site names as they are.',
  },
  editorLinkPreviewTitle: {
    id: 'document.editorLinkPreviewTitle',
    defaultMessage: 'Link preview',
    description:
      "Item of the rich text editor's menu of blocks, opened by typing a slash, that adds a card showing a web page's title, description and picture.",
  },
  editorLinkPreviewSubtext: {
    id: 'document.editorLinkPreviewSubtext',
    defaultMessage: "A card with the page's title and picture",
    description: 'Line under "Link preview" in the rich text editor\'s menu of blocks, saying what the block shows.',
  },
  editorLinkPreviewAdd: {
    id: 'document.editorLinkPreviewAdd',
    defaultMessage: 'Add a link preview',
    description:
      'What a link preview block says before it has a link, in the place the card will go. Clicking it opens the field to paste the link in.',
  },
  editorLinkPreviewButton: {
    id: 'document.editorLinkPreviewButton',
    defaultMessage: 'Preview link',
    description:
      'Button beside the field where the link of a link preview block is pasted, which reads the page and makes the card.',
  },
  editorLinkPreviewInvalid: {
    id: 'document.editorLinkPreviewInvalid',
    defaultMessage: 'Paste a web address, starting with https://',
    description:
      'Message under the field where the link of a link preview block is pasted, when what was pasted is not a web address.',
  },
  editorMentionDocuments: {
    id: 'document.editorMentionDocuments',
    defaultMessage: 'Documents',
    description:
      "Heading of the group of the team's documents, its notes and plans, in the menu that typing @ opens in the text editor, to mention one in the text.",
  },
  editorMentionTasks: {
    id: 'document.editorMentionTasks',
    defaultMessage: 'Tasks',
    description:
      "Heading of the group of the team's tasks, the cards on its board, in the menu that typing @ opens in the text editor, to mention one in the text.",
  },
  editorMentionItem: {
    id: 'document.editorMentionItem',
    defaultMessage: 'Mention',
    description:
      "Item of the text editor's menu of blocks, opened by typing a slash, that opens the menu of the team's documents and tasks to mention one in the text.",
  },
  editorMentionItemSubtext: {
    id: 'document.editorMentionItemSubtext',
    defaultMessage: 'A document or a task',
    description:
      'Line under "Mention" in the text editor\'s menu of blocks, saying what can be mentioned: one of the team\'s documents, or a task on its board.',
  },
  editorMentionDocumentGone: {
    id: 'document.editorMentionDocumentGone',
    defaultMessage: "(no longer among the team's documents)",
    description:
      "Read by screen readers after a mention, in the text, of one of the team's documents, such as a note or a plan, that was deleted since. Shown crossed out to sighted readers.",
  },
  editorMentionTaskGone: {
    id: 'document.editorMentionTaskGone',
    defaultMessage: "(no longer on the team's board)",
    description:
      "Read by screen readers after a mention, in the text, of a task on the team's board, the shared list of work to do, that was deleted since. Shown crossed out to sighted readers.",
  },
  editorImageTypeError: {
    id: 'document.editorImageTypeError',
    defaultMessage: 'A picture is a PNG, JPEG, GIF or WebP file.',
    description: 'Message shown when somebody puts a file that is not a supported picture into a document.',
  },
  editorImageSizeError: {
    id: 'document.editorImageSizeError',
    defaultMessage: 'A picture can weigh up to {megabytes, number} MB.',
    description: 'Message shown when somebody puts a picture too large into a document.',
  },
  editorImageUploadError: {
    id: 'document.editorImageUploadError',
    defaultMessage: 'The picture could not be uploaded. Check your connection and try again.',
    description: 'Message shown when a picture put into a document could not be stored.',
  },
  addAspects: {
    id: 'document.addAspects',
    defaultMessage: 'Add aspects',
    description:
      'Button under the title of a document that has no aspects yet, which opens the list of aspects to tag it with. Aspects are the parts of a company, such as strategy or finances.',
  },
  editAspects: {
    id: 'document.editAspects',
    defaultMessage: 'Edit aspects: {aspects}',
    description:
      "Accessible name of the button under a document's title that shows the icons of the aspects it is tagged with and opens the list to change them. {aspects} lists their names.",
  },
  aspectsTitle: {
    id: 'document.aspectsTitle',
    defaultMessage: 'Aspects',
    description: 'Title of the dialog that tags a document with aspects of the company, such as strategy or finances.',
  },
  aspectsDescription: {
    id: 'document.aspectsDescription',
    defaultMessage: 'It shows up on the page of each aspect it is tagged with.',
    description:
      'Line under the title of the dialog that tags a document with aspects of the company, saying where a tagged document appears.',
  },
  aspectsSelected: {
    id: 'document.aspectsSelected',
    defaultMessage: '{count} selected',
    description: 'How many aspects are picked, at the bottom of the dialog that tags a document with them.',
  },
  cancel: {
    id: 'document.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes the aspects dialog without changing the document.',
  },
  save: {
    id: 'document.save',
    defaultMessage: 'Save',
    description: 'Button that tags the document with the aspects picked in the dialog.',
  },
  close: {
    id: 'document.close',
    defaultMessage: 'Close',
    description: 'Accessible name of the button that closes the aspects dialog.',
  },
  aiPermissions: {
    id: 'document.aiPermissions',
    defaultMessage: 'AI permissions',
    description:
      "Accessible name of the button under a document's title that opens a menu of what the product's AI agents may do with the document, and that menu's heading.",
  },
  aiRead: {
    id: 'document.aiRead',
    defaultMessage: 'Read',
    description: "Checkbox in a document's AI permissions menu: whether the product's AI agents may read the document.",
  },
  aiWrite: {
    id: 'document.aiWrite',
    defaultMessage: 'Write',
    description:
      "Checkbox in a document's AI permissions menu: whether the product's AI agents may change the document. Disabled while they may not read it.",
  },
  aiReadWrite: {
    id: 'document.aiReadWrite',
    defaultMessage: 'AI can read and edit this document',
    description:
      "Tooltip of the AI permissions button of a document that the product's AI agents may both read and change.",
  },
  aiReadOnly: {
    id: 'document.aiReadOnly',
    defaultMessage: 'AI can read this document but not edit it',
    description:
      "Tooltip of the AI permissions button of a document that the product's AI agents may read but not change.",
  },
  aiNoAccess: {
    id: 'document.aiNoAccess',
    defaultMessage: 'AI can neither read nor edit this document',
    description:
      "Tooltip of the AI permissions button of a document that the product's AI agents may neither read nor change.",
  },
  moreActions: {
    id: 'document.moreActions',
    defaultMessage: 'More actions',
    description: "Accessible name of the button that opens a document's menu, which holds History and Delete.",
  },
  history: {
    id: 'document.history',
    defaultMessage: 'History',
    description:
      "Item of a document's menu that opens the list of its earlier versions, the text as it stood before each change an AI agent made.",
  },
  delete: {
    id: 'document.delete',
    defaultMessage: 'Delete',
    description: "Item of a document's menu that deletes it.",
  },
  confirm: {
    id: 'document.confirm',
    defaultMessage: 'Confirm?',
    description:
      'What the Delete item of the menu turns into after a first click, asking for a second to delete the document.',
  },
  deleted: {
    id: 'document.deleted',
    defaultMessage: 'Deleted {title}',
    description: 'Notification once a document is deleted. {title} is its title, or "Untitled".',
  },
  undo: {
    id: 'document.undo',
    defaultMessage: 'Undo',
    description: 'Button in a notification that takes back the delete it announces.',
  },
  deleteError: {
    id: 'document.deleteError',
    defaultMessage: 'The document could not be deleted. Try again.',
    description: 'Notification when a document could not be deleted.',
  },
  restoreError: {
    id: 'document.restoreError',
    defaultMessage: 'The document could not be brought back.',
    description: 'Notification when taking back the delete of a document failed.',
  },
  historyTitle: {
    id: 'document.historyTitle',
    defaultMessage: 'History',
    description:
      "Title of the dialog listing a document's earlier versions, the text as it stood before each change an AI agent made to it.",
  },
  historyDescription: {
    id: 'document.historyDescription',
    defaultMessage:
      'The text as it stood before each change an AI agent made, kept for {days} days. Restoring one writes it back as a new change, which this list can undo too.',
    description:
      'Line under the title of the dialog listing the earlier versions of a document. {days} is a number of days, such as 30.',
  },
  historyClose: {
    id: 'document.historyClose',
    defaultMessage: 'Close',
    description: "Accessible name of the button that closes the dialog listing a document's earlier versions.",
  },
  historyEmpty: {
    id: 'document.historyEmpty',
    defaultMessage: 'No AI agent changed this document in the last {days} days.',
    description:
      'What the history dialog of a document says when no AI agent changed it lately. {days} is a number of days, such as 30.',
  },
  historyError: {
    id: 'document.historyError',
    defaultMessage: 'The history could not be loaded.',
    description: 'What the history dialog of a document says when its earlier versions could not be read.',
  },
  revisionByStrategyDance: {
    id: 'document.revisionByStrategyDance',
    defaultMessage: 'Strategy Dance changed it for {name}',
    description:
      "An entry of a document's history: the product's own AI changed the document in a conversation with a member. {name} is the member's name. Strategy Dance is the product's name, kept as it is.",
  },
  revisionByAgent: {
    id: 'document.revisionByAgent',
    defaultMessage: 'An AI agent {name} connected changed it',
    description:
      "An entry of a document's history: an AI agent from another company, which a member connected to the product, changed the document. {name} is that member's name.",
  },
  revisionRestored: {
    id: 'document.revisionRestored',
    defaultMessage: '{name} restored the version of {date}',
    description:
      "An entry of a document's history: a member brought back an earlier version of its text. {name} is the member's name, {date} the date and time of the version brought back.",
  },
  revisionFormerMember: {
    id: 'document.revisionFormerMember',
    defaultMessage: 'a former member',
    description:
      "Stands for the name of somebody whose account is gone, in an entry of a document's history, such as 'Strategy Dance changed it for a former member'.",
  },
  revisionJustNow: {
    id: 'document.revisionJustNow',
    defaultMessage: 'Just now',
    description: "When an entry of a document's history was made, less than a minute ago.",
  },
  revisionOpenConversation: {
    id: 'document.revisionOpenConversation',
    defaultMessage: 'Open the conversation',
    description:
      "Link, on an entry of a document's history, to the reader's own conversation with the product's AI in which it made the change.",
  },
  revisionView: {
    id: 'document.revisionView',
    defaultMessage: 'View the text before',
    description: "Button on an entry of a document's history that shows the text as it stood before that change.",
  },
  revisionHide: {
    id: 'document.revisionHide',
    defaultMessage: 'Hide the text',
    description: "Button on an entry of a document's history that hides the text it shows.",
  },
  revisionTextError: {
    id: 'document.revisionTextError',
    defaultMessage: 'The text could not be loaded.',
    description: "What an entry of a document's history says when the text it keeps could not be read.",
  },
  revisionTextEmpty: {
    id: 'document.revisionTextEmpty',
    defaultMessage: 'The document held no text.',
    description:
      "What an entry of a document's history shows when the document held no text before that change, only a title.",
  },
  restoreVersion: {
    id: 'document.restoreVersion',
    defaultMessage: 'Restore this version',
    description:
      "Button on an entry of a document's history that puts the text back as it stood before that change, after asking.",
  },
  restoreVersionWarning: {
    id: 'document.restoreVersionWarning',
    defaultMessage:
      'The text goes back to how it stood before this change. Everything written since goes too: {count, plural, =0 {whatever members typed} one {# later change listed here and whatever members typed} other {# later changes listed here and whatever members typed}}.',
    description:
      "What an entry of a document's history says before its earlier text is restored. {count} is how many entries above it in the history, newer changes, are undone too.",
  },
  restoreVersionConfirm: {
    id: 'document.restoreVersionConfirm',
    defaultMessage: 'Restore',
    description:
      "Button that confirms putting a document's text back as it stood before a change, under the warning of what goes with it.",
  },
  restoreVersionCancel: {
    id: 'document.restoreVersionCancel',
    defaultMessage: 'Cancel',
    description: "Button that keeps a document's text as it is, rather than restore an earlier version.",
  },
  restoreVersionWaiting: {
    id: 'document.restoreVersionWaiting',
    defaultMessage: 'Your latest changes are still being saved. Restore once they are.',
    description:
      "Line under the restore button of a document's history while the reader's own typing has not reached the server yet.",
  },
  versionRestored: {
    id: 'document.versionRestored',
    defaultMessage: 'The text is back as it stood on {date}',
    description:
      "Notification once an earlier version of a document's text is restored. {date} is the date and time of that version.",
  },
  undoRestore: {
    id: 'document.undoRestore',
    defaultMessage: 'Undo',
    description: "Button in a notification that takes back the restore of an earlier version of a document's text.",
  },
  versionRestoreError: {
    id: 'document.versionRestoreError',
    defaultMessage: 'This version could not be restored. Try again.',
    description: "Notification when restoring an earlier version of a document's text failed.",
  },
  versionUnrestorable: {
    id: 'document.versionUnrestorable',
    defaultMessage: 'This version cannot be restored as the document stands now.',
    description:
      "Notification when an earlier version of a document's text cannot be written back, for instance because the document would grow too long.",
  },
  versionGone: {
    id: 'document.versionGone',
    defaultMessage: 'This version is no longer kept.',
    description:
      "Notification when an earlier version of a document's text is gone, past the days it is kept or with the document deleted.",
  },
  restoreUndoError: {
    id: 'document.restoreUndoError',
    defaultMessage: 'The restore could not be undone. The history can still bring back the text from before it.',
    description:
      "Notification when taking back the restore of an earlier version of a document's text failed, for instance as somebody typed in it meanwhile. The history is the list of the document's earlier versions.",
  },
  aspectEmptyTitle: {
    id: 'document.aspectEmptyTitle',
    defaultMessage: 'No documents for {aspect} yet',
    description:
      "Title of what the Documents section of an aspect's page shows while no document is tagged with that aspect. {aspect} is its name, such as Strategy.",
  },
  aspectEmptyText: {
    id: 'document.aspectEmptyText',
    defaultMessage: 'Documents tagged with {aspect} appear here.',
    description:
      "Line under the title of the empty Documents section of an aspect's page. {aspect} is the aspect's name, such as Strategy.",
  },
  leaveTitle: {
    id: 'document.leaveTitle',
    defaultMessage: 'Leave without saving?',
    description:
      'Title of the dialog asked when leaving the page of a document whose latest changes could not be saved.',
  },
  leaveText: {
    id: 'document.leaveText',
    defaultMessage: 'Some of your changes could not be saved. If you leave now, they are lost.',
    description:
      'Line under the title of the dialog asked when leaving a document with changes that could not be saved.',
  },
  stay: {
    id: 'document.stay',
    defaultMessage: 'Stay',
    description: 'Button of the leave dialog that keeps the reader on the document, with their changes.',
  },
  leave: {
    id: 'document.leave',
    defaultMessage: 'Leave',
    description: 'Button of the leave dialog that leaves the document, giving up the changes that could not be saved.',
  },
  notFoundTitle: {
    id: 'document.notFoundTitle',
    defaultMessage: 'This document no longer exists',
    description: 'Title of what the page of a document shows when there is no such document.',
  },
  notFoundText: {
    id: 'document.notFoundText',
    defaultMessage: 'It was deleted, or the link is out of date.',
    description: 'Line under the title of what the page of a document shows when there is no such document.',
  },
  goToAll: {
    id: 'document.goToAll',
    defaultMessage: 'Go to all documents',
    description: 'Button, on the page of a document that no longer exists, to the list of every document.',
  },
})

export default documentMessages
