import { defineMessages } from 'react-intl'

/*
  The reader's conversations with Strategy Dance, the app's AI: the page that lists them, and the
  words the list uses for each conversation's last entry. Registered for the whole app, since the
  sidebar and the dock read it on every page.

  A conversation is private: only its author sees it. A run is one go of the AI answering, and a
  tool is something the AI uses along the way, such as searching the company's knowledge
*/
const conversationMessages = defineMessages({
  lead: {
    id: 'conversation.lead',
    defaultMessage: 'Chats with Strategy Dance. Get ready to be challenged.',
    description:
      "Line under the title of the Conversations page, which lists the reader's private conversations with Strategy Dance, the app's AI. Strategy Dance is the product's name.",
  },
  emptyTitle: {
    id: 'conversation.emptyTitle',
    defaultMessage: 'No conversations yet',
    description: 'Title of what the Conversations page shows while the reader has had no conversation with the AI.',
  },
  emptyText: {
    id: 'conversation.emptyText',
    defaultMessage: 'Ask Strategy Dance about a decision, a plan or what to do next.',
    description:
      "Line under the title of the Conversations page's empty state. Strategy Dance is the product's name, and the name of its AI.",
  },
  new: {
    id: 'conversation.new',
    defaultMessage: 'New conversation',
    description: 'Button that starts a new conversation with the AI, on the page that lists them.',
  },
  loadError: {
    id: 'conversation.loadError',
    defaultMessage: 'Your conversations could not be loaded. Check your connection and try again.',
    description: 'What the Conversations page shows in place of its list when it could not be read.',
  },
  retry: {
    id: 'conversation.retry',
    defaultMessage: 'Try again',
    description: 'Button that reads the conversations again after they failed to load.',
  },
  searchLabel: {
    id: 'conversation.search.label',
    defaultMessage: 'Search conversations',
    description:
      "Placeholder and accessible name of the field above the Conversations page's list, which finds the reader's conversations whose title or one message holds every word typed.",
  },
  searchTooManyWords: {
    id: 'conversation.search.tooManyWords',
    defaultMessage: 'Search with at most {max, number} words.',
    description:
      'Shown under the conversations search field when the reader typed more words than a search takes, and nothing is searched until they remove some. {max} is a number such as 8.',
  },
  searchNoMatchTitle: {
    id: 'conversation.search.noMatchTitle',
    defaultMessage: 'No conversations match “{query}”',
    description:
      "Title of what the Conversations page shows when no conversation holds every word searched for. {query} is what the reader typed. Use your language's quotation marks.",
  },
  searchNoMatchText: {
    id: 'conversation.search.noMatchText',
    defaultMessage: 'Search looks at titles and messages.',
    description:
      'Line under the title shown when a search of the conversations found nothing, saying what the search reads: their titles and the messages in them.',
  },
  searchClear: {
    id: 'conversation.search.clear',
    defaultMessage: 'Clear search',
    description: 'Button that empties the conversations search field, so the whole list shows again.',
  },
  searchBestMatches: {
    id: 'conversation.search.bestMatches',
    defaultMessage: 'Showing the best matches. Add a word to find the rest.',
    description:
      'Line above the search results when so many messages matched that the search kept only the most relevant conversations. Adding a word narrows the search.',
  },
  searchRecent: {
    id: 'conversation.search.recent',
    defaultMessage: 'Searched every title, and the messages of your most recent conversations.',
    description:
      "Line above the results of a search in Chinese or Japanese, which reads the titles of all the reader's conversations but only the messages of the latest ones.",
  },
  searchError: {
    id: 'conversation.search.error',
    defaultMessage: 'The search failed. Check your connection and try again.',
    description: 'Shown in place of the search results when the search could not be done.',
  },
  searchTooMany: {
    id: 'conversation.search.tooMany',
    defaultMessage: 'You searched many times in a few minutes. Try again shortly.',
    description:
      'Shown in place of the search results when the reader made as many searches as anybody may in ten minutes.',
  },
  searchRetry: {
    id: 'conversation.search.retry',
    defaultMessage: 'Try again',
    description: 'Button that runs the same search again after it failed.',
  },
  columnConversation: {
    id: 'conversation.column.conversation',
    defaultMessage: 'Conversation',
    description:
      "Header of the Conversations page's table column that holds each conversation's title and a line of its last message.",
  },
  columnAspects: {
    id: 'conversation.column.aspects',
    defaultMessage: 'Aspects',
    description:
      "Header of the Conversations page's table column that shows which aspects of the company, such as strategy or finances, a conversation is about.",
  },
  columnUpdated: {
    id: 'conversation.column.updated',
    defaultMessage: 'Updated',
    description: "Header of the Conversations page's table column that shows when each conversation last changed.",
  },
  columnActions: {
    id: 'conversation.column.actions',
    defaultMessage: 'Actions',
    description:
      "Header of the Conversations page's table column of buttons, such as Delete, read by screen readers only.",
  },
  needsAnswer: {
    id: 'conversation.needsAnswer',
    defaultMessage: 'Needs your answer',
    description:
      "Badge beside a conversation's title when the AI asked the reader a question there and waits for their answer.",
  },
  updatedJustNow: {
    id: 'conversation.updatedJustNow',
    defaultMessage: 'Just now',
    description: 'When a conversation last changed, if that was less than a minute ago, in the Updated column.',
  },
  delete: {
    id: 'conversation.delete',
    defaultMessage: 'Delete',
    description: "Tooltip of the button in a conversation's row that deletes it.",
  },
  deleteLabel: {
    id: 'conversation.deleteLabel',
    defaultMessage: 'Delete {title}',
    description:
      "What a screen reader says for the button in a conversation's row that deletes it. {title} is the conversation's title.",
  },
  openInDock: {
    id: 'conversation.openInDock',
    defaultMessage: 'Open in dock',
    description:
      "Tooltip of the button in a conversation's row, and button on a conversation's page, that opens it as a small window pinned to the bottom right of the screen, beside whatever page the reader is on.",
  },
  openInDockLabel: {
    id: 'conversation.openInDockLabel',
    defaultMessage: 'Open {title} in dock',
    description:
      "What a screen reader says for the button in a conversation's row that opens it as a small window pinned to the bottom right of the screen. {title} is the conversation's title.",
  },
  showInDock: {
    id: 'conversation.showInDock',
    defaultMessage: 'Show in dock',
    description:
      "Tooltip of the button in a conversation's row when the conversation is already open as a small window pinned to the bottom right of the screen, which brings that window forward and opens it.",
  },
  showInDockLabel: {
    id: 'conversation.showInDockLabel',
    defaultMessage: 'Show {title} in dock',
    description:
      "What a screen reader says for the button in a conversation's row when the conversation is already open as a small window pinned to the bottom right of the screen. {title} is the conversation's title.",
  },
  confirm: {
    id: 'conversation.confirm',
    defaultMessage: 'Confirm?',
    description: 'What the Delete button of a conversation turns into after a first click, asking for a second.',
  },
  deleted: {
    id: 'conversation.deleted',
    defaultMessage: 'Deleted {title}',
    description: "Notification once a conversation is deleted. {title} is the conversation's title.",
  },
  undo: {
    id: 'conversation.undo',
    defaultMessage: 'Undo',
    description: 'Button in a notification that takes back the delete it announces.',
  },
  deleteError: {
    id: 'conversation.deleteError',
    defaultMessage: 'The conversation could not be deleted. Try again.',
    description: 'Notification when a conversation could not be deleted.',
  },
  restoreError: {
    id: 'conversation.restoreError',
    defaultMessage: 'The conversation could not be brought back.',
    description: 'Notification when taking back the delete of a conversation failed.',
  },

  /* ---
    PREVIEW: the line under a conversation's title, which says what its last entry is
  --- */

  previewThinking: {
    id: 'conversation.preview.thinking',
    defaultMessage: 'Thinking…',
    description: "A conversation's preview line while the AI is working on its answer.",
  },
  previewEmpty: {
    id: 'conversation.preview.empty',
    defaultMessage: 'No messages yet',
    description: "A conversation's preview line when it holds nothing yet.",
  },
  previewMember: {
    id: 'conversation.preview.member',
    defaultMessage: 'You: {text}',
    description:
      "A conversation's preview line when its last entry is the reader's own message. {text} is the start of that message.",
  },
  previewFiles: {
    id: 'conversation.preview.files',
    defaultMessage: '{count, plural, one {# file} other {# files}}',
    description:
      "How many files the reader's own message sent, shown in a conversation's preview line after 'You:' when the message holds files and no words. {count} is 2 or more.",
  },
  previewQuestion: {
    id: 'conversation.preview.question',
    defaultMessage: 'Question: {text}',
    description:
      "A conversation's preview line when its last entry is a question from the AI waiting for an answer. {text} is the question.",
  },
  previewSkipped: {
    id: 'conversation.preview.skipped',
    defaultMessage: 'Skipped: {text}',
    description:
      "A conversation's preview line when its last entry is a question from the AI that the reader skipped by writing something else. {text} is the question.",
  },
  previewAnswered: {
    id: 'conversation.preview.answered',
    defaultMessage: 'Answered: {text}',
    description:
      "A conversation's preview line when its last entry is a question from the AI that the reader answered. {text} is the answer: the options they chose, separated by commas.",
  },
  previewToolFailed: {
    id: 'conversation.preview.toolFailed',
    defaultMessage: '{label} · Failed',
    description:
      'A conversation\'s preview line when its last entry is something the AI did that failed. {label} says what it did, such as "Searching the web".',
  },
  previewToolCancelled: {
    id: 'conversation.preview.toolCancelled',
    defaultMessage: '{label} · Cancelled',
    description:
      'A conversation\'s preview line when its last entry is something the AI did that was cancelled, because the reader stopped it. {label} says what it did, such as "Searching the web".',
  },
  previewApproval: {
    id: 'conversation.preview.approval',
    defaultMessage: 'Approval: {server} · {tool}',
    description:
      "A conversation's preview line when its last entry is an action the AI wants to take in another company's service, waiting for the reader to allow it. {server} is the service's name, such as Stripe, and {tool} the action's technical name, such as create_payment_link, kept as it is.",
  },
  previewAllowed: {
    id: 'conversation.preview.allowed',
    defaultMessage: 'Allowed: {server} · {tool}',
    description:
      "A conversation's preview line when its last entry is an action in another company's service that the reader allowed and that has not run yet. {server} is the service's name, such as Stripe, and {tool} the action's technical name, kept as it is.",
  },
  previewDenied: {
    id: 'conversation.preview.denied',
    defaultMessage: 'Denied: {server} · {tool}',
    description:
      "A conversation's preview line when its last entry is an action in another company's service that was not allowed. {server} is the service's name, such as Stripe, and {tool} the action's technical name, kept as it is.",
  },

  /* ---
    NOTES: what the thread says when a run ends otherwise than with an answer
  --- */

  noteStopped: {
    id: 'conversation.note.stopped',
    defaultMessage: 'You stopped this response.',
    description: 'Note in a conversation where the reader stopped the AI while it was answering.',
  },
  noteFailed: {
    id: 'conversation.note.failed',
    defaultMessage: 'Something went wrong, and this response stopped.',
    description: 'Note in a conversation where the AI could not finish its answer because of an error.',
  },
  noteRefused: {
    id: 'conversation.note.refused',
    defaultMessage: 'Strategy Dance could not answer this.',
    description:
      "Note in a conversation where the AI declined to answer the reader's message. Strategy Dance is the AI's name.",
  },
  noteInterrupted: {
    id: 'conversation.note.interrupted',
    defaultMessage: 'This response was interrupted.',
    description:
      "Note in a conversation where the AI's answer was cut off, for example because the server restarted, and can be resumed.",
  },
  noteFull: {
    id: 'conversation.note.full',
    defaultMessage: 'This conversation is full. Start a new one to go on.',
    description: 'Note in a conversation that holds as much as it can, so it takes no more messages.',
  },
  subagentNoteStopped: {
    id: 'conversation.note.subagentStopped',
    defaultMessage: 'This subagent was stopped.',
    description:
      'Note in the work of a subagent, a helper the AI handed one piece of work to, where it was stopped before it finished, by the reader or by the AI.',
  },
  subagentNoteFailed: {
    id: 'conversation.note.subagentFailed',
    defaultMessage: 'Something went wrong, and this subagent stopped.',
    description:
      'Note in the work of a subagent, a helper the AI handed one piece of work to, where it could not finish because of an error.',
  },
  subagentNoteRefused: {
    id: 'conversation.note.subagentRefused',
    defaultMessage: 'Strategy Dance could not do this work.',
    description:
      "Note in the work of a subagent, a helper the AI handed one piece of work to, where the AI declined to do it. Strategy Dance is the AI's name.",
  },
  subagentNoteInterrupted: {
    id: 'conversation.note.subagentInterrupted',
    defaultMessage: 'This subagent was interrupted.',
    description:
      'Note in the work of a subagent, a helper the AI handed one piece of work to, where its work was cut off, for example because the server restarted.',
  },
  subagentNoteFull: {
    id: 'conversation.note.subagentFull',
    defaultMessage: 'This subagent’s work grew as large as it can, and it stopped.',
    description:
      'Note in the work of a subagent, a helper the AI handed one piece of work to, where it held as much as it can, so it went no further.',
  },
  noteResume: {
    id: 'conversation.note.resume',
    defaultMessage: 'Resume',
    description:
      'Button under the note that ends a conversation when the reader stopped the AI or its answer was interrupted. It lets the AI carry the same answer on.',
  },
  noteRetry: {
    id: 'conversation.note.retry',
    defaultMessage: 'Retry',
    description:
      "Button under the note that ends a conversation when the AI's answer stopped, failed or was refused. It removes that answer and has the AI answer the reader's last message again.",
  },
  retryDialogTitle: {
    id: 'conversation.retryDialog.title',
    defaultMessage: 'Retry this response?',
    description:
      'Title of the dialog that asks before the AI answers the reader’s last message again, when its answer launched subagents, helpers it handed pieces of work to, which retrying discards.',
  },
  retryDialogDiscarded: {
    id: 'conversation.retryDialog.discarded',
    defaultMessage:
      '{total, plural, one {Retrying discards the subagent this response launched, and its report.} other {Retrying discards the # subagents this response launched, and their reports.}}',
    description:
      'In the dialog that asks before the AI answers the reader’s last message again: the subagents its answer launched, helpers it handed pieces of work to, go with it. {total} is how many.',
  },
  retryDialogAllWorking: {
    id: 'conversation.retryDialog.allWorking',
    defaultMessage:
      '{working, plural, one {It is still working, and stops first.} other {They are all still working, and stop first.}}',
    description:
      'In the dialog that asks before the AI answers the reader’s last message again, when every subagent it discards is still working. {working} is how many.',
  },
  retryDialogSomeWorking: {
    id: 'conversation.retryDialog.someWorking',
    defaultMessage:
      '{working, plural, one {One of them is still working, and stops first.} other {# of them are still working, and stop first.}}',
    description:
      'In the dialog that asks before the AI answers the reader’s last message again, when some of the subagents it discards are still working. {working} is how many.',
  },
  retryDialogKept: {
    id: 'conversation.retryDialog.kept',
    defaultMessage:
      '{total, plural, one {What it changed in your knowledge and tasks stays as it is.} other {What they changed in your knowledge and tasks stays as it is.}}',
    description:
      'In the dialog that asks before the AI answers the reader’s last message again: the documents and tasks the discarded subagents created or changed are not undone. {total} is how many subagents.',
  },
  retryDialogConfirm: {
    id: 'conversation.retryDialog.confirm',
    defaultMessage: 'Retry',
    description:
      'Button of the dialog that asks before the AI answers the reader’s last message again, which discards the subagents its answer launched and retries.',
  },
  retryDialogCancel: {
    id: 'conversation.retryDialog.cancel',
    defaultMessage: 'Cancel',
    description:
      'Button of the dialog that asks before the AI answers the reader’s last message again, which closes it and leaves the answer and its subagents as they are.',
  },
  noteActionError: {
    id: 'conversation.note.actionError',
    defaultMessage: 'That did not go through. Check your connection and try again.',
    description: "Shown under the Resume and Retry buttons when the server did not take the reader's click.",
  },

  /* ---
    TOOLS: what the AI is doing, then what it did, for each thing it can use
  --- */

  toolWebSearchRunning: {
    id: 'conversation.tool.webSearch.running',
    defaultMessage: 'Searching the web',
    description: 'What the AI is doing while it searches the web.',
  },
  toolWebSearchDone: {
    id: 'conversation.tool.webSearch.done',
    defaultMessage: 'Searched the web',
    description: 'What the AI did once it searched the web.',
  },
  toolSearchKnowledgeRunning: {
    id: 'conversation.tool.searchKnowledge.running',
    defaultMessage: 'Searching knowledge',
    description:
      "What the AI is doing while it searches the team's knowledge, the notes, plans and decisions written down about the company.",
  },
  toolSearchKnowledgeDone: {
    id: 'conversation.tool.searchKnowledge.done',
    defaultMessage: 'Searched knowledge',
    description:
      "What the AI did once it searched the team's knowledge, the notes, plans and decisions written down about the company.",
  },
  toolListKnowledgeRunning: {
    id: 'conversation.tool.listKnowledge.running',
    defaultMessage: 'Listing knowledge',
    description:
      "What the AI is doing while it looks through the list of the team's knowledge, the notes, plans and decisions written down about the company.",
  },
  toolListKnowledgeDone: {
    id: 'conversation.tool.listKnowledge.done',
    defaultMessage: 'Listed knowledge',
    description:
      "What the AI did once it looked through the list of the team's knowledge, the notes, plans and decisions written down about the company. Past tense.",
  },
  toolReadKnowledgeRunning: {
    id: 'conversation.tool.readKnowledge.running',
    defaultMessage: 'Opening knowledge',
    description: "What the AI is doing while it opens an item of the team's knowledge, such as a note or a plan.",
  },
  toolReadKnowledgeDone: {
    id: 'conversation.tool.readKnowledge.done',
    defaultMessage: 'Opened knowledge',
    description: "What the AI did once it opened an item of the team's knowledge, such as a note or a plan.",
  },
  toolCreateKnowledgeRunning: {
    id: 'conversation.tool.createKnowledge.running',
    defaultMessage: 'Creating knowledge',
    description: "What the AI is doing while it writes a new item of the team's knowledge, such as a note or a plan.",
  },
  toolCreateKnowledgeDone: {
    id: 'conversation.tool.createKnowledge.done',
    defaultMessage: 'Created knowledge',
    description: "What the AI did once it wrote a new item of the team's knowledge, such as a note or a plan.",
  },
  toolUpdateKnowledgeRunning: {
    id: 'conversation.tool.updateKnowledge.running',
    defaultMessage: 'Updating knowledge',
    description: "What the AI is doing while it changes an item of the team's knowledge, such as a note or a plan.",
  },
  toolUpdateKnowledgeDone: {
    id: 'conversation.tool.updateKnowledge.done',
    defaultMessage: 'Updated knowledge',
    description: "What the AI did once it changed an item of the team's knowledge, such as a note or a plan.",
  },
  toolTagKnowledgeRunning: {
    id: 'conversation.tool.tagKnowledge.running',
    defaultMessage: 'Tagging knowledge',
    description:
      "What the AI is doing while it tags an item of the team's knowledge with the aspects of the company it is about, such as strategy or sales.",
  },
  toolTagKnowledgeDone: {
    id: 'conversation.tool.tagKnowledge.done',
    defaultMessage: 'Tagged knowledge',
    description:
      "What the AI did once it tagged an item of the team's knowledge with the aspects of the company it is about, such as strategy or sales. Past tense.",
  },
  toolDeleteKnowledgeRunning: {
    id: 'conversation.tool.deleteKnowledge.running',
    defaultMessage: 'Deleting knowledge',
    description: "What the AI is doing while it deletes an item of the team's knowledge, such as a note or a plan.",
  },
  toolDeleteKnowledgeDone: {
    id: 'conversation.tool.deleteKnowledge.done',
    defaultMessage: 'Deleted knowledge',
    description:
      "What the AI did once it deleted an item of the team's knowledge, such as a note or a plan. Past tense.",
  },
  toolRestoreKnowledgeRunning: {
    id: 'conversation.tool.restoreKnowledge.running',
    defaultMessage: 'Restoring knowledge',
    description:
      "What the AI is doing while it brings back an item of the team's knowledge that was deleted, such as a note or a plan.",
  },
  toolRestoreKnowledgeDone: {
    id: 'conversation.tool.restoreKnowledge.done',
    defaultMessage: 'Restored knowledge',
    description:
      "What the AI did once it brought back an item of the team's knowledge that was deleted, such as a note or a plan. Past tense.",
  },
  toolListTasksRunning: {
    id: 'conversation.tool.listTasks.running',
    defaultMessage: 'Listing tasks',
    description:
      "What the AI is doing while it looks through the tasks on the team's board, the shared list of work to do.",
  },
  toolListTasksDone: {
    id: 'conversation.tool.listTasks.done',
    defaultMessage: 'Listed tasks',
    description:
      "What the AI did once it looked through the tasks on the team's board, the shared list of work to do. Past tense.",
  },
  toolReadTaskRunning: {
    id: 'conversation.tool.readTask.running',
    defaultMessage: 'Opening a task',
    description: "What the AI is doing while it opens a task on the team's board, the shared list of work to do.",
  },
  toolReadTaskDone: {
    id: 'conversation.tool.readTask.done',
    defaultMessage: 'Opened a task',
    description:
      "What the AI did once it opened a task on the team's board, the shared list of work to do. Past tense.",
  },
  toolCreateTaskRunning: {
    id: 'conversation.tool.createTask.running',
    defaultMessage: 'Creating a task',
    description: "What the AI is doing while it adds a new task to the team's board, the shared list of work to do.",
  },
  toolCreateTaskDone: {
    id: 'conversation.tool.createTask.done',
    defaultMessage: 'Created a task',
    description:
      "What the AI did once it added a new task to the team's board, the shared list of work to do. Past tense.",
  },
  toolUpdateTaskRunning: {
    id: 'conversation.tool.updateTask.running',
    defaultMessage: 'Updating a task',
    description:
      "What the AI is doing while it changes a task on the team's board, the shared list of work to do, such as its name, its column or who it is assigned to.",
  },
  toolUpdateTaskDone: {
    id: 'conversation.tool.updateTask.done',
    defaultMessage: 'Updated a task',
    description:
      "What the AI did once it changed a task on the team's board, the shared list of work to do, such as its name, its column or who it is assigned to. Past tense.",
  },
  toolLinkTasksRunning: {
    id: 'conversation.tool.linkTasks.running',
    defaultMessage: 'Linking tasks',
    description: "What the AI is doing while it marks a task on the team's board as waiting on another one.",
  },
  toolLinkTasksDone: {
    id: 'conversation.tool.linkTasks.done',
    defaultMessage: 'Linked tasks',
    description: "What the AI did once it marked a task on the team's board as waiting on another one. Past tense.",
  },
  toolUnlinkTasksRunning: {
    id: 'conversation.tool.unlinkTasks.running',
    defaultMessage: 'Unlinking tasks',
    description: "What the AI is doing while it marks a task on the team's board as no longer waiting on another one.",
  },
  toolUnlinkTasksDone: {
    id: 'conversation.tool.unlinkTasks.done',
    defaultMessage: 'Unlinked tasks',
    description:
      "What the AI did once it marked a task on the team's board as no longer waiting on another one. Past tense.",
  },
  toolDeleteTaskRunning: {
    id: 'conversation.tool.deleteTask.running',
    defaultMessage: 'Deleting a task',
    description: "What the AI is doing while it deletes a task on the team's board, the shared list of work to do.",
  },
  toolDeleteTaskDone: {
    id: 'conversation.tool.deleteTask.done',
    defaultMessage: 'Deleted a task',
    description:
      "What the AI did once it deleted a task on the team's board, the shared list of work to do. Past tense.",
  },
  toolRestoreTaskRunning: {
    id: 'conversation.tool.restoreTask.running',
    defaultMessage: 'Restoring a task',
    description:
      "What the AI is doing while it brings back a task on the team's board, the shared list of work to do that was deleted.",
  },
  toolRestoreTaskDone: {
    id: 'conversation.tool.restoreTask.done',
    defaultMessage: 'Restored a task',
    description:
      "What the AI did once it brought back a task on the team's board, the shared list of work to do that was deleted. Past tense.",
  },
  toolListIntegrationsRunning: {
    id: 'conversation.tool.listIntegrations.running',
    defaultMessage: 'Listing integrations',
    description:
      "What the AI is doing while it looks at the organization's integrations, the services of other companies, such as a payment or calendar service, that the organization connected to Strategy Dance.",
  },
  toolListIntegrationsDone: {
    id: 'conversation.tool.listIntegrations.done',
    defaultMessage: 'Listed integrations',
    description:
      "What the AI did once it looked at the organization's integrations, the services of other companies that the organization connected to Strategy Dance. Past tense.",
  },
  toolDescribeIntegrationToolRunning: {
    id: 'conversation.tool.describeIntegrationTool.running',
    defaultMessage: 'Reading an integration’s tool',
    description:
      'What the AI is doing while it reads how to use one of the actions an integration offers, an integration being the service of another company connected to Strategy Dance.',
  },
  toolDescribeIntegrationToolDone: {
    id: 'conversation.tool.describeIntegrationTool.done',
    defaultMessage: 'Read an integration’s tool',
    description:
      'What the AI did once it read how to use one of the actions an integration offers, an integration being the service of another company connected to Strategy Dance. Past tense.',
  },
  toolCallIntegrationRunning: {
    id: 'conversation.tool.callIntegration.running',
    defaultMessage: 'Calling an integration',
    description:
      "What the AI is doing while it uses one of the organization's integrations, the service of another company connected to Strategy Dance, when the service's name is not known.",
  },
  toolCallIntegrationDone: {
    id: 'conversation.tool.callIntegration.done',
    defaultMessage: 'Called an integration',
    description:
      "What the AI did once it used one of the organization's integrations, the service of another company connected to Strategy Dance, when the service's name is not known. Past tense.",
  },
  toolListSubagentsRunning: {
    id: 'conversation.tool.listSubagents.running',
    defaultMessage: 'Listing subagents',
    description:
      'What the AI is doing while it looks at the subagents it launched in this conversation, a subagent being a helper the AI hands one piece of work to, which works on its own and reports back.',
  },
  toolListSubagentsDone: {
    id: 'conversation.tool.listSubagents.done',
    defaultMessage: 'Listed subagents',
    description:
      'What the AI did once it looked at the subagents it launched in this conversation, a subagent being a helper the AI hands one piece of work to, which works on its own and reports back. Past tense.',
  },
  toolReadSubagentRunning: {
    id: 'conversation.tool.readSubagent.running',
    defaultMessage: 'Reading a subagent’s work',
    description:
      'What the AI is doing while it reads what one of its subagents did and reported, a subagent being a helper the AI hands one piece of work to, which works on its own and reports back.',
  },
  toolReadSubagentDone: {
    id: 'conversation.tool.readSubagent.done',
    defaultMessage: 'Read a subagent’s work',
    description:
      'What the AI did once it read what one of its subagents did and reported, a subagent being a helper the AI hands one piece of work to, which works on its own and reports back. Past tense.',
  },
  toolLaunchSubagentRunning: {
    id: 'conversation.tool.launchSubagent.running',
    defaultMessage: 'Launching a subagent',
    description:
      'What the AI is doing while it hands one piece of work to a subagent, a helper that works on its own, in parallel with others, and reports back.',
  },
  toolLaunchSubagentDone: {
    id: 'conversation.tool.launchSubagent.done',
    defaultMessage: 'Launched a subagent',
    description:
      'What the AI did once it handed one piece of work to a subagent, a helper that works on its own, in parallel with others, and reports back. Past tense.',
  },
  toolStopSubagentRunning: {
    id: 'conversation.tool.stopSubagent.running',
    defaultMessage: 'Stopping a subagent',
    description:
      'What the AI is doing while it stops one of its subagents, a subagent being a helper the AI hands one piece of work to, which works on its own and reports back.',
  },
  toolStopSubagentDone: {
    id: 'conversation.tool.stopSubagent.done',
    defaultMessage: 'Stopped a subagent',
    description:
      'What the AI did once it stopped one of its subagents, a subagent being a helper the AI hands one piece of work to, which works on its own and reports back. Past tense.',
  },
  integrationCallRunning: {
    id: 'conversation.integrationCall.running',
    defaultMessage: 'Calling {server}',
    description:
      "What the AI is doing while it uses one of the organization's integrations, the service of another company connected to Strategy Dance. {server} is the service's name, such as Stripe.",
  },
  integrationCallDone: {
    id: 'conversation.integrationCall.done',
    defaultMessage: 'Called {server}',
    description:
      "What the AI did once it used one of the organization's integrations, the service of another company connected to Strategy Dance. {server} is the service's name, such as Stripe. Past tense.",
  },

  /* ---
    PAGE: one conversation, its bar, its title and its aspects
  --- */

  allConversations: {
    id: 'conversation.allConversations',
    defaultMessage: 'All conversations',
    description: "Link at the top of a conversation's page, back to the list of the reader's conversations.",
  },
  private: {
    id: 'conversation.private',
    defaultMessage: 'Private',
    description: "Label beside a lock at the top of a conversation's page, saying nobody else can read it.",
  },
  privateTooltip: {
    id: 'conversation.privateTooltip',
    defaultMessage: 'Only you can see your conversations',
    description: 'Tooltip on the Private label of a conversation, saying what it means.',
  },
  updated: {
    id: 'conversation.updated',
    defaultMessage: 'Updated {time}',
    description:
      "At the top of a conversation's page, when it last changed. {time} is a relative time such as '5 min ago' or 'Just now', or a date such as 'Oct 2'.",
  },
  notSaved: {
    id: 'conversation.notSaved',
    defaultMessage: 'Not saved until you send a message',
    description: "At the top of a new conversation's page, which is not kept until the reader writes to the AI.",
  },
  newTitle: {
    id: 'conversation.newTitle',
    defaultMessage: 'New conversation',
    description: 'Title of a conversation the reader has just started, before its first message.',
  },
  addAspects: {
    id: 'conversation.addAspects',
    defaultMessage: 'Add aspects',
    description:
      'Button under the title of a conversation that has no aspects yet, which opens the list of aspects to tag it with. Aspects are the parts of a company, such as strategy or finances.',
  },
  editAspects: {
    id: 'conversation.editAspects',
    defaultMessage: 'Edit aspects: {aspects}',
    description:
      "Accessible name of the button under a conversation's title that shows the icons of the aspects it is tagged with and opens the list to change them. {aspects} lists their names.",
  },
  aspectsTitle: {
    id: 'conversation.aspectsTitle',
    defaultMessage: 'Aspects',
    description:
      'Title of the dialog that tags a conversation with aspects of the company, such as strategy or finances.',
  },
  aspectsDescription: {
    id: 'conversation.aspectsDescription',
    defaultMessage: 'Strategy Dance tags a conversation by itself until you pick its aspects.',
    description:
      "Line under the title of the dialog that tags a conversation with aspects of the company. The AI, Strategy Dance, picks a conversation's aspects by itself until the reader picks them.",
  },
  aspectsSelected: {
    id: 'conversation.aspectsSelected',
    defaultMessage: '{count} selected',
    description: 'How many aspects are picked, at the bottom of the dialog that tags a conversation with them.',
  },
  aspectsFull: {
    id: 'conversation.aspectsFull',
    defaultMessage: 'This conversation is full, so its aspects can no longer change.',
    description:
      'In the aspects dialog of a conversation that holds as many messages as a conversation may. Changing the aspects adds a line to the conversation, which has no room left.',
  },
  aspectsError: {
    id: 'conversation.aspectsError',
    defaultMessage: 'The aspects could not be saved. Check your connection and try again.',
    description: 'In the aspects dialog of a conversation, when saving them failed.',
  },
  cancel: {
    id: 'conversation.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that closes the aspects dialog without changing the conversation.',
  },
  save: {
    id: 'conversation.save',
    defaultMessage: 'Save',
    description: 'Button that tags the conversation with the aspects picked in the dialog.',
  },
  close: {
    id: 'conversation.close',
    defaultMessage: 'Close',
    description: "Accessible name of the button that closes one of a conversation's dialogs.",
  },
  missingTitle: {
    id: 'conversation.missingTitle',
    defaultMessage: 'This conversation no longer exists',
    description: 'Title of what the page of a conversation shows when there is no such conversation.',
  },
  missingText: {
    id: 'conversation.missingText',
    defaultMessage: 'It was deleted, or the link is out of date.',
    description: 'Line under the title of what the page of a conversation that does not exist shows.',
  },
  conversationLoadError: {
    id: 'conversation.conversationLoadError',
    defaultMessage: 'This conversation could not be loaded. Check your connection and try again.',
    description: "What a conversation's page shows in place of the conversation when it could not be read.",
  },

  /* ---
    THREAD: the messages of a conversation, between the reader and Strategy Dance, the AI
  --- */

  threadLabel: {
    id: 'conversation.threadLabel',
    defaultMessage: 'Messages',
    description: "Accessible name of the list of a conversation's messages.",
  },
  attachmentOpen: {
    id: 'conversation.attachmentOpen',
    defaultMessage: 'Open {name}',
    description:
      "Accessible name of the thumbnail of an image the reader sent in a message, which opens it whole. {name} is the image's file name, such as screenshot.png.",
  },
  attachmentImageFailed: {
    id: 'conversation.attachmentImageFailed',
    defaultMessage: '{name} could not be loaded',
    description:
      "Accessible name of the placeholder shown instead of an image the reader sent in a message, when the image could not be read. {name} is the image's file name, such as screenshot.png.",
  },
  threadEmpty: {
    id: 'conversation.threadEmpty',
    defaultMessage: 'Ask about your company, a decision, or what to do next. Type @ to mention knowledge.',
    description:
      'What a new conversation shows before its first message. Knowledge is what the organization keeps written down, such as notes, plans and decisions; typing @ in the message field lists it.',
  },
  olderError: {
    id: 'conversation.olderError',
    defaultMessage: 'Older messages could not be loaded.',
    description: 'At the top of a conversation, when its earlier messages could not be read.',
  },
  messageLoading: {
    id: 'conversation.messageLoading',
    defaultMessage: 'Loading this message',
    description: 'Accessible name of the placeholder that stands in for a message of a conversation while it loads.',
  },
  toolBadge: {
    id: 'conversation.toolBadge',
    defaultMessage: 'Tool',
    description:
      'Small badge beside something the AI used while answering, such as a search of the knowledge, to tell it from a message.',
  },
  toolStatusRunning: {
    id: 'conversation.toolStatus.running',
    defaultMessage: 'Running',
    description: 'The state of a tool the AI is using while answering, which has not finished.',
  },
  toolStatusFailed: {
    id: 'conversation.toolStatus.failed',
    defaultMessage: 'Failed',
    description: 'The state of a tool the AI used while answering, which went wrong.',
  },
  toolStatusCancelled: {
    id: 'conversation.toolStatus.cancelled',
    defaultMessage: 'Cancelled',
    description:
      'The state of a tool the AI was about to use, which stopped before it ran because the reader stopped the answer.',
  },
  integrationBadge: {
    id: 'conversation.integrationBadge',
    defaultMessage: 'MCP',
    description:
      "Small badge beside an action the AI took in another company's service, one of the organization's integrations, to tell it from Strategy Dance's own tools. MCP is the name of the protocol such services are reached by, kept as it is.",
  },
  approvalStatusAllowed: {
    id: 'conversation.approvalStatus.allowed',
    defaultMessage: 'Allowed',
    description:
      "The state of an action in another company's service that the reader allowed the AI to take, which has not run yet.",
  },
  approvalStatusDenied: {
    id: 'conversation.approvalStatus.denied',
    defaultMessage: 'Denied',
    description:
      "The state of an action in another company's service that the AI wanted to take and that was not allowed: the reader denied it, wrote something else instead, or the service changed since.",
  },
  integrationMissing: {
    id: 'conversation.integration.missing',
    defaultMessage: '{server} is no longer one of your integrations.',
    description:
      "Under an action the AI took in another company's service, when that service is no longer connected to the organization. {server} is the service's name, such as Stripe.",
  },
  integrationMissingAskAdministrator: {
    id: 'conversation.integration.missingAskAdministrator',
    defaultMessage: '{server} is no longer one of your integrations. Ask an administrator to add it.',
    description:
      "Under an action the AI took in another company's service, when that service is no longer connected to the organization, for a reader who cannot add it. {server} is the service's name, such as Stripe.",
  },
  integrationOff: {
    id: 'conversation.integration.off',
    defaultMessage: '{server} is turned off.',
    description:
      "Under an action the AI took in another company's service, when an administrator turned that service off for the organization. {server} is the service's name, such as Stripe.",
  },
  integrationOffAskAdministrator: {
    id: 'conversation.integration.offAskAdministrator',
    defaultMessage: '{server} is turned off. Ask an administrator to turn it on.',
    description:
      "Under an action the AI took in another company's service, when that service is turned off, for a reader who cannot turn it on. {server} is the service's name, such as Stripe.",
  },
  integrationNotConnected: {
    id: 'conversation.integration.notConnected',
    defaultMessage: '{server} isn’t connected to your account.',
    description:
      "Under an action the AI took in another company's service, when the reader has not connected their own account at that service, or has to connect it again. {server} is the service's name, such as Stripe.",
  },
  integrationAdd: {
    id: 'conversation.integration.add',
    defaultMessage: 'Add',
    description:
      "Button under an action the AI took in another company's service that is no longer connected to the organization: opens the page where an administrator adds it again.",
  },
  integrationTurnOn: {
    id: 'conversation.integration.turnOn',
    defaultMessage: 'Turn on',
    description:
      "Button under an action the AI took in another company's service that is turned off: opens the page where an administrator turns it on.",
  },
  integrationConnect: {
    id: 'conversation.integration.connect',
    defaultMessage: 'Connect',
    description:
      "Button under an action the AI took in another company's service, when the reader's own account there is not connected: opens the page where they connect it.",
  },
  documentGone: {
    id: 'conversation.documentGone',
    defaultMessage: "(no longer in the team's knowledge)",
    description:
      "Read by screen readers after a link in the AI's reply to an item of the team's knowledge, such as a note or a plan, that was deleted since. Shown crossed out to sighted readers.",
  },
  taskGone: {
    id: 'conversation.taskGone',
    defaultMessage: "(no longer on the team's board)",
    description:
      "Read by screen readers after a link in the AI's reply to a task on the team's board, the shared list of work to do, that was deleted since. Shown crossed out to sighted readers.",
  },
  restoreDocument: {
    id: 'conversation.restoreDocument',
    defaultMessage: 'Restore',
    description:
      "Button on the line saying the AI deleted an item of the team's knowledge, such as a note or a plan, which brings the item back. Offered for a day after the delete.",
  },
  restoreDocumentError: {
    id: 'conversation.restoreDocumentError',
    defaultMessage: 'The knowledge could not be brought back.',
    description:
      "Notification when bringing back an item of the team's knowledge the AI deleted failed, for instance once a day has passed since the delete.",
  },
  restoreTask: {
    id: 'conversation.restoreTask',
    defaultMessage: 'Restore',
    description:
      "Button on the line saying the AI deleted a task on the team's board, the shared list of work to do, which brings the task back. Offered for a day after the delete.",
  },
  restoreTaskError: {
    id: 'conversation.restoreTaskError',
    defaultMessage: 'The task could not be brought back.',
    description:
      "Notification when bringing back a task on the team's board that the AI deleted failed, for instance once a day has passed since the delete.",
  },
  toolCall: {
    id: 'conversation.toolCall',
    defaultMessage: 'Tool call · {name}',
    description:
      "Line under the title of the dialog showing a tool the AI used. {name} is the tool's technical name, such as search_documents, kept as it is.",
  },
  integrationToolCall: {
    id: 'conversation.integrationToolCall',
    defaultMessage: 'MCP server call',
    description:
      "Line under the title of the dialog showing an action the AI took in another company's service. MCP is the name of the protocol such services are reached by, kept as it is.",
  },
  integrationToolCallTitle: {
    id: 'conversation.integrationToolCallTitle',
    defaultMessage: '{server} · {tool}',
    description:
      "Title of the dialog showing an action the AI took in another company's service. {server} is the service's name, such as Stripe, and {tool} the action's technical name, such as create_payment_link, kept as it is.",
  },
  toolInput: {
    id: 'conversation.toolInput',
    defaultMessage: 'Input',
    description: 'Heading over what a tool the AI used was given, in the dialog that shows the call.',
  },
  toolOutput: {
    id: 'conversation.toolOutput',
    defaultMessage: 'Output',
    description: 'Heading over what a tool the AI used gave back, in the dialog that shows the call.',
  },
  toolError: {
    id: 'conversation.toolError',
    defaultMessage: 'Error',
    description: 'Heading over how a tool the AI used failed, in the dialog that shows the call.',
  },
  copyOutput: {
    id: 'conversation.copyOutput',
    defaultMessage: 'Copy output',
    description: 'Button that copies what a tool the AI used gave back.',
  },
  copyError: {
    id: 'conversation.copyError',
    defaultMessage: 'Copy error',
    description: 'Button that copies how a tool the AI used failed.',
  },
  copied: {
    id: 'conversation.copied',
    defaultMessage: 'Copied',
    description: 'What the copy button of a tool call says for a moment after it copied.',
  },
  toolCallLoadError: {
    id: 'conversation.toolCallLoadError',
    defaultMessage: 'This call could not be loaded. Check your connection and try again.',
    description: 'In the dialog that shows a tool the AI used, when its input and output could not be read.',
  },
  questionWaiting: {
    id: 'conversation.question.waiting',
    defaultMessage: 'Waiting for your answer',
    description: 'Small heading over a question the AI asked the reader, which they have not answered yet.',
  },
  questionSelectOne: {
    id: 'conversation.question.selectOne',
    defaultMessage: 'Select one',
    description: 'Hint under a question the AI asked, whose answer is one of its options.',
  },
  questionSelectAll: {
    id: 'conversation.question.selectAll',
    defaultMessage: 'Select all that apply',
    description: 'Hint under a question the AI asked, whose answer can be several of its options.',
  },
  questionWriteOwn: {
    id: 'conversation.question.writeOwn',
    defaultMessage: 'Write your own answer',
    description: "Placeholder of the field under a question's options, where the reader answers in their own words.",
  },
  questionOwnAnswer: {
    id: 'conversation.question.ownAnswer',
    defaultMessage: 'Your own answer',
    description: 'Under an answer the reader wrote in their own words rather than picked from the options.',
  },
  questionSend: {
    id: 'conversation.question.send',
    defaultMessage: 'Send answer',
    description: "Button that sends the reader's answer to a question the AI asked.",
  },
  questionAnswered: {
    id: 'conversation.question.answered',
    defaultMessage: 'Answered',
    description: 'Small heading over a question the AI asked, which the reader has answered.',
  },
  questionSkipped: {
    id: 'conversation.question.skipped',
    defaultMessage: 'Skipped',
    description:
      'Small heading over a question the AI asked, which the reader did not answer and wrote something else instead.',
  },
  questionUnanswered: {
    id: 'conversation.question.unanswered',
    defaultMessage: 'Not answered',
    description:
      'Small heading over a question the AI asked that the reader cannot answer for now, because the response it belongs to was stopped or cut off. Resuming the response makes it answerable again.',
  },
  questionError: {
    id: 'conversation.question.error',
    defaultMessage: 'Your answer could not be sent. Check your connection and try again.',
    description: "Shown under a question when sending the reader's answer failed. Their choices stay as they were.",
  },
  questionConflict: {
    id: 'conversation.question.conflict',
    defaultMessage: 'This question was answered or skipped elsewhere.',
    description:
      "Shown under a question when the reader's answer was refused because the question was answered in another tab, or skipped by a message sent meanwhile.",
  },
  questionUnavailable: {
    id: 'conversation.question.unavailable',
    defaultMessage: 'Your answer is kept. Strategy Dance will go on in a moment.',
    description:
      "Shown under a question when the reader's answer was saved but the AI could not start on it right away. It starts by itself shortly.",
  },
  questionQueued: {
    id: 'conversation.question.queued',
    defaultMessage: 'Your answer is kept. Strategy Dance will go on once one of your other conversations is done.',
    description:
      "Shown under a question when the reader's answer was saved, but the AI is already answering in as many of the reader's other conversations as it can at once, so it starts on this one later, by itself.",
  },
  approvalWaiting: {
    id: 'conversation.approval.waiting',
    defaultMessage: 'Waiting for your approval',
    description:
      "Small heading over an action the AI wants to take in another company's service as the reader, such as creating a payment link, which waits for the reader to allow or deny it.",
  },
  approvalUnanswered: {
    id: 'conversation.approval.unanswered',
    defaultMessage: 'Not answered',
    description:
      "Small heading over an action the AI wanted to take in another company's service that the reader cannot allow for now, because the response it belongs to was stopped or cut off. Resuming the response makes it answerable again.",
  },
  approvalPrompt: {
    id: 'conversation.approval.prompt',
    defaultMessage: 'Strategy Dance wants to use {server}.',
    description:
      "Says what the reader is asked to allow: the AI wants to take an action in another company's service, with the reader's own account there or the organization's key. {server} is the service's name, such as Stripe.",
  },
  approvalArguments: {
    id: 'conversation.approval.arguments',
    defaultMessage: 'What it sends',
    description: "Label over what the AI would send to another company's service if the reader allows the action.",
  },
  approvalAllow: {
    id: 'conversation.approval.allow',
    defaultMessage: 'Allow',
    description:
      "Button to allow the AI to take an action in another company's service. It first shows everything the action sends, to allow there.",
  },
  approvalDeny: {
    id: 'conversation.approval.deny',
    defaultMessage: 'Deny',
    description: "Button to refuse the AI an action in another company's service. The AI is told it was refused.",
  },
  approvalDialogTitle: {
    id: 'conversation.approval.dialogTitle',
    defaultMessage: 'Allow {server} · {tool}?',
    description:
      "Title of the dialog where the reader allows an action the AI wants to take in another company's service. {server} is the service's name, such as Stripe, and {tool} the action's technical name, such as create_payment_link, kept as it is.",
  },
  approvalDialogDescription: {
    id: 'conversation.approval.dialogDescription',
    defaultMessage: 'Strategy Dance will send exactly this. Read it before you allow it.',
    description:
      "Under the title of the dialog where the reader allows an action in another company's service, above everything the action sends.",
  },
  approvalDialogCancel: {
    id: 'conversation.approval.dialogCancel',
    defaultMessage: 'Cancel',
    description:
      "Button that closes the dialog where the reader allows an action in another company's service, without deciding anything.",
  },
  approvalConflict: {
    id: 'conversation.approval.conflict',
    defaultMessage: 'This action no longer waits for you.',
    description:
      "Shown under an action in another company's service when the reader's decision came too late: they wrote something else meanwhile, or it was decided elsewhere.",
  },
  approvalUnavailable: {
    id: 'conversation.approval.unavailable',
    defaultMessage: 'Your decision is kept, but Strategy Dance cannot go on right now. It will try again by itself.',
    description:
      "Shown under an action in another company's service when the reader's decision was saved but the AI could not start right away.",
  },
  approvalError: {
    id: 'conversation.approval.error',
    defaultMessage: 'Your decision could not be sent. Check your connection and try again.',
    description: "Shown under an action in another company's service when the reader's Allow or Deny failed to send.",
  },
  approvalQueued: {
    id: 'conversation.approval.queued',
    defaultMessage: 'Your decision is kept. Strategy Dance will go on once one of your other conversations is done.',
    description:
      "Shown under an action in another company's service when the reader's decision was saved, but the AI is already answering in as many of the reader's other conversations as it can at once, so it goes on with this one later, by itself.",
  },
  approvalChanged: {
    id: 'conversation.approval.changed',
    defaultMessage:
      '{server} changed since this was proposed, so it was not sent. Strategy Dance will propose it again if it still needs it.',
    description:
      "Shown under an action in another company's service when the reader allowed it, but the service, the action or the reader's account there changed after the AI proposed it, so it was refused instead. {server} is the service's name, such as Stripe.",
  },
  aspectsTagged: {
    id: 'conversation.aspectsNote.tagged',
    defaultMessage: 'Strategy Dance tagged this conversation',
    description:
      "Line in a conversation, over the aspects the AI tagged it with. Strategy Dance is the product's name, and its AI's.",
  },
  aspectsChanged: {
    id: 'conversation.aspectsNote.changed',
    defaultMessage: 'You changed the aspects',
    description: 'Line in a conversation, over the aspects the reader tagged it with.',
  },
  aspectsRemoved: {
    id: 'conversation.aspectsNote.removed',
    defaultMessage: 'You removed all aspects',
    description: 'Line in a conversation, when the reader took every aspect off it.',
  },
  sources: {
    id: 'conversation.sources',
    defaultMessage: 'Sources',
    description: 'Label over the list of web pages a reply from the AI cites, under the reply.',
  },
  citationLabel: {
    id: 'conversation.citationLabel',
    defaultMessage: 'Source {number}: {title}',
    description:
      'Accessible name and tooltip of the small number after a sentence of a reply that cites a web page. {number} is the source in the list under the reply, {title} the page.',
  },
  stopping: {
    id: 'conversation.stopping',
    defaultMessage: 'Stopping',
    description: 'What the AI is shown doing once the reader asked it to stop answering, until it has.',
  },
  thinking: {
    id: 'conversation.thinking',
    defaultMessage: 'Thinking',
    description: 'What the AI is shown doing while it works on an answer and says nothing more precise.',
  },
  working: {
    id: 'conversation.working',
    defaultMessage: 'Strategy Dance is working: {step}',
    description:
      "Accessible name of the indicator shown while the AI works on an answer. {step} is what it is doing, such as 'Thinking' or 'Searching the web'.",
  },
  elapsedSeconds: {
    id: 'conversation.elapsedSeconds',
    defaultMessage: '{seconds}s',
    description:
      'How long the AI has been working on an answer, in seconds, kept short as a timer. {seconds} is a number such as 12.',
  },
  elapsedMinutes: {
    id: 'conversation.elapsedMinutes',
    defaultMessage: '{minutes}m {seconds}s',
    description:
      'How long the AI has been working on an answer, in minutes and seconds, kept short as a timer. {seconds} has two digits, such as 05.',
  },

  /* ---
    SUBAGENTS: the helpers Strategy Dance hands pieces of work to, each working on its own and
    reporting back, which the thread draws and the reader can follow and stop
  --- */

  subagentBadge: {
    id: 'conversation.subagent.badge',
    defaultMessage: 'Subagent',
    description:
      'Small label on the row of a subagent in a conversation, a subagent being a helper Strategy Dance, the AI, hands one piece of work to, which works on its own and reports back.',
  },
  subagentStatusQueued: {
    id: 'conversation.subagent.status.queued',
    defaultMessage: 'Queued',
    description: 'On the row of a subagent, a helper the AI handed one piece of work to: it is about to start.',
  },
  subagentStatusWaitingForSlot: {
    id: 'conversation.subagent.status.waitingForSlot',
    defaultMessage: 'Waiting for a slot',
    description:
      'On the row of a subagent, a helper the AI handed one piece of work to: it waits to start, since only a few of the reader’s subagents work at once.',
  },
  subagentStatusWorking: {
    id: 'conversation.subagent.status.working',
    defaultMessage: 'Working',
    description: 'On the row of a subagent, a helper the AI handed one piece of work to: it is doing that work.',
  },
  subagentStatusStopping: {
    id: 'conversation.subagent.status.stopping',
    defaultMessage: 'Stopping',
    description:
      'On the row of a subagent, a helper the AI handed one piece of work to: it was asked to stop and is about to.',
  },
  subagentStatusReported: {
    id: 'conversation.subagent.status.reported',
    defaultMessage: 'Reported',
    description:
      'On the row of a subagent, a helper the AI handed one piece of work to: it finished and wrote its report of what it did.',
  },
  subagentStatusStopped: {
    id: 'conversation.subagent.status.stopped',
    defaultMessage: 'Stopped',
    description:
      'On the row of a subagent, a helper the AI handed one piece of work to: it was stopped before it finished, and reported what it had.',
  },
  subagentStatusFailed: {
    id: 'conversation.subagent.status.failed',
    defaultMessage: 'Failed',
    description:
      'On the row of a subagent, a helper the AI handed one piece of work to: it stopped at an error, and reported what it had.',
  },
  subagentStatusInterrupted: {
    id: 'conversation.subagent.status.interrupted',
    defaultMessage: 'Interrupted',
    description:
      'On the row of a subagent, a helper the AI handed one piece of work to: it was cut off, by a server stopping say, and reported what it had.',
  },
  subagentStop: {
    id: 'conversation.subagent.stop',
    defaultMessage: 'Stop',
    description: 'Button that stops one subagent, a helper the AI handed one piece of work to, while it works.',
  },
  subagentStopLabel: {
    id: 'conversation.subagent.stopLabel',
    defaultMessage: 'Stop {title}',
    description:
      'Accessible name of the button that stops one subagent, a helper the AI handed one piece of work to. {title} is what the AI called that piece of work, such as Research the competitors.',
  },
  subagentStopError: {
    id: 'conversation.subagent.stopError',
    defaultMessage: 'The subagent could not be stopped. Try again.',
    description: 'Shown when stopping a subagent, a helper the AI handed one piece of work to, did not go through.',
  },
  subagentViewWork: {
    id: 'conversation.subagent.viewWork',
    defaultMessage: 'View work',
    description:
      'Button that opens everything a subagent, a helper the AI handed one piece of work to, did: its instructions, what it used and what it wrote.',
  },
  subagentViewWorkLabel: {
    id: 'conversation.subagent.viewWorkLabel',
    defaultMessage: 'View the work of {title}',
    description:
      'Accessible name of the button that opens everything a subagent did, a subagent being a helper the AI handed one piece of work to. {title} is what the AI called that piece of work, such as Research the competitors.',
  },
  subagentReport: {
    id: 'conversation.subagent.report',
    defaultMessage: 'Report',
    description:
      'Heading over what a subagent, a helper the AI handed one piece of work to, wrote once it finished: what it did, found and changed.',
  },
  subagentReportCopy: {
    id: 'conversation.subagent.reportCopy',
    defaultMessage: 'Copy report',
    description: 'Button that copies the report a subagent, a helper the AI handed one piece of work to, wrote.',
  },
  subagentReportEmpty: {
    id: 'conversation.subagent.reportEmpty',
    defaultMessage: 'This subagent wrote no report.',
    description:
      'Where the report of a subagent, a helper the AI handed one piece of work to, would be, when it has none.',
  },
  subagentReportLoadError: {
    id: 'conversation.subagent.reportLoadError',
    defaultMessage: 'This report could not be loaded. Check your connection and try again.',
    description:
      'Where the report of a subagent, a helper the AI handed one piece of work to, would be, when it could not be read.',
  },
  subagentWorkDescription: {
    id: 'conversation.subagent.workDescription',
    defaultMessage: 'Subagent · {status}',
    description:
      'Line under the title of the window that shows everything a subagent did, a subagent being a helper the AI handed one piece of work to. {status} says where it stands, such as Working or Reported.',
  },
  subagentWorkLoadError: {
    id: 'conversation.subagent.workLoadError',
    defaultMessage: 'This work could not be loaded. Check your connection and try again.',
    description:
      'In the window that shows everything a subagent did, a subagent being a helper the AI handed one piece of work to, when it could not be read.',
  },
  subagentWorkMissing: {
    id: 'conversation.subagent.workMissing',
    defaultMessage: 'This work is no longer there.',
    description:
      'In the window that shows everything a subagent did, a subagent being a helper the AI handed one piece of work to, when it was deleted meanwhile.',
  },
  subagentsWorking: {
    id: 'conversation.subagents.working',
    defaultMessage: '{count, plural, one {# subagent working} other {# subagents working}}',
    description:
      'Above the field where the reader writes to the AI, while some of the subagents it launched in this conversation still work, a subagent being a helper the AI hands one piece of work to. {count} is how many.',
  },
  subagentsStopAll: {
    id: 'conversation.subagents.stopAll',
    defaultMessage: 'Stop all',
    description:
      'Button beside the number of subagents still working in a conversation, which stops every one of them, a subagent being a helper the AI hands one piece of work to.',
  },
  subagentsStopAllError: {
    id: 'conversation.subagents.stopAllError',
    defaultMessage: 'The subagents could not be stopped. Try again.',
    description:
      'Shown when stopping every subagent of a conversation, the helpers the AI handed pieces of work to, did not go through.',
  },
  subagentsReportsWaiting: {
    id: 'conversation.subagents.reportsWaiting',
    defaultMessage:
      '{count, plural, one {# report waiting. Your next message delivers it.} other {# reports waiting. Your next message delivers them.}}',
    description:
      'Above the field where the reader writes to the AI, when subagents, the helpers the AI handed pieces of work to, have reported while the AI stopped, so the AI reads their reports only once the reader writes again. {count} is how many reports.',
  },
  briefLabel: {
    id: 'conversation.subagent.brief',
    defaultMessage: 'Brief',
    description:
      'Label above the instructions Strategy Dance, the AI, wrote for one of its subagents, a helper it hands one piece of work to, at the top of that helper’s work.',
  },

  /* ---
    COMPOSER: the field at the foot of a conversation where the reader writes to Strategy Dance
  --- */
  composerLabel: {
    id: 'conversation.composer.label',
    defaultMessage: 'Message',
    description: 'Accessible name of the field where the reader writes their next message to the AI.',
  },
  composerPlaceholder: {
    id: 'conversation.composer.placeholder',
    defaultMessage: 'Message Strategy Dance',
    description:
      "Placeholder of the field where the reader writes their next message. Strategy Dance is the product's name, and the name of its AI.",
  },
  composerSend: {
    id: 'conversation.composer.send',
    defaultMessage: 'Send',
    description: 'Accessible name of the button, an arrow, that sends what the reader wrote to the AI.',
  },
  composerStop: {
    id: 'conversation.composer.stop',
    defaultMessage: 'Stop response',
    description:
      'Accessible name of the button, a square, that takes the place of Send while the AI answers, and stops the answer.',
  },
  composerStopError: {
    id: 'conversation.composer.stopError',
    defaultMessage: 'The response could not be stopped. Check your connection and try again.',
    description:
      'Shown above the message field when the reader asked the AI to stop answering and the server did not get it.',
  },
  composerError: {
    id: 'conversation.composer.error',
    defaultMessage: 'Your message could not be sent. Check your connection and try again.',
    description: 'Shown above the message field when sending failed. What the reader wrote stays in the field.',
  },
  composerBusy: {
    id: 'conversation.composer.busy',
    defaultMessage: 'Strategy Dance is still answering you. Send this again once a reply is done.',
    description:
      "Shown above the message field when the AI is already answering, in this conversation or in several of the reader's others, so it cannot take another message yet. What the reader wrote stays in the field.",
  },
  composerUnavailable: {
    id: 'conversation.composer.unavailable',
    defaultMessage: 'Strategy Dance cannot take messages right now. Try again later.',
    description:
      'Shown above the message field when the server could not take the message for now. What the reader wrote stays in the field.',
  },
  composerAttach: {
    id: 'conversation.composer.attach',
    defaultMessage: 'Attach',
    description:
      "Accessible name and tooltip of the + button beside the message field, whose menu adds something to the message, such as a mention of the team's knowledge.",
  },
  composerMentionKnowledge: {
    id: 'conversation.composer.mentionKnowledge',
    defaultMessage: 'Mention knowledge',
    description:
      "Item of the + menu beside the message field. It writes @ in the message and lists the team's knowledge documents, such as a note or a plan, to mention, so the AI reads them.",
  },
  composerTooLong: {
    id: 'conversation.composer.tooLong',
    defaultMessage: 'This message is too long to send. Shorten it a little.',
    description:
      'Shown above the message field when what the reader wrote, with the documents it mentions, is longer than a message may be. Send is disabled until it is shorter.',
  },
  composerFiles: {
    id: 'conversation.composer.files',
    defaultMessage: 'Files and images',
    description:
      "Item of the + menu beside the message field. It opens the device's file picker to attach images, PDFs or text files to the message, which the AI then reads.",
  },
  composerAttachmentsLabel: {
    id: 'conversation.composer.attachmentsLabel',
    defaultMessage: 'Attached files',
    description: 'Accessible name of the row of files attached to the message being written, above the message field.',
  },
  composerAttachmentRemove: {
    id: 'conversation.composer.attachmentRemove',
    defaultMessage: 'Remove {name}',
    description:
      "Accessible name of the small cross on a file attached to the message being written, which takes it out of the message. {name} is the file's name, such as plan.pdf.",
  },
  composerAttachmentRetry: {
    id: 'conversation.composer.attachmentRetry',
    defaultMessage: 'Upload {name} again',
    description:
      "Accessible name of the button on a file attached to the message whose upload failed, which uploads it again. {name} is the file's name, such as plan.pdf.",
  },
  composerAttachmentUploading: {
    id: 'conversation.composer.attachmentUploading',
    defaultMessage: 'Uploading {name}',
    description:
      "Accessible name of the progress bar on a file attached to the message while it uploads. {name} is the file's name, such as plan.pdf.",
  },
  composerAttachmentsFailed: {
    id: 'conversation.composer.attachmentsFailed',
    defaultMessage: 'A file could not be uploaded. Check your connection, then upload it again or remove it.',
    description:
      'Shown above the message field while a file attached to the message failed to upload, for a reason trying again may fix. The file stays, marked, with a button to upload it again.',
  },
  composerAttachmentUnsupported: {
    id: 'conversation.composer.attachmentUnsupported',
    defaultMessage: '“{name}” cannot be attached. Strategy Dance reads images, PDFs and text files.',
    description:
      "Shown above the message field when the reader tried to attach a file of a kind the AI cannot read, such as a video or a Word document, or one that is damaged. {name} is the file's name. Strategy Dance is the product's name, and the name of its AI.",
  },
  composerAttachmentTooLarge: {
    id: 'conversation.composer.attachmentTooLarge',
    defaultMessage:
      '“{name}” is too large to attach. A file can hold up to {megabytes, number} MB, a PDF {pages, number} pages and a text file {characters, number} characters.',
    description:
      "Shown above the message field when the reader tried to attach a file larger than the AI takes. {name} is the file's name. {megabytes} is 10, {pages} is 100 and {characters} is 200000.",
  },
  composerImageTooLarge: {
    id: 'conversation.composer.imageTooLarge',
    defaultMessage:
      '“{name}” is too large to attach. An image can hold up to {imageMegabytes, number} MB and {pixels, number} pixels a side.',
    description:
      "Shown above the message field when the reader tried to attach an image larger than the AI takes, such as a large animated GIF. {name} is the file's name. {imageMegabytes} is 5 and {pixels} is 8000.",
  },
  composerAttachmentEmpty: {
    id: 'conversation.composer.attachmentEmpty',
    defaultMessage: '“{name}” is empty, so there is nothing to attach.',
    description:
      "Shown above the message field when the reader tried to attach an empty file. {name} is the file's name.",
  },
  composerAttachmentsPerMessage: {
    id: 'conversation.composer.attachmentsPerMessage',
    defaultMessage: 'A message can hold up to {max, number} files. Send these first, then attach the rest.',
    description:
      'Shown above the message field when the reader tried to attach more files than one message holds. {max} is a number such as 10.',
  },
  composerAttachmentsPending: {
    id: 'conversation.composer.attachmentsPending',
    defaultMessage: 'You have {max, number} files waiting to be sent. Send or remove some to attach more.',
    description:
      'Shown above the message field when the reader has attached as many files not sent yet, across all their conversations, as they may. {max} is a number such as 30.',
  },
  composerOverBudget: {
    id: 'conversation.composer.overBudget',
    defaultMessage:
      'This conversation has no room for these files. Remove them to send your message, or start a new conversation for them.',
    description:
      'Shown above the message field when sending failed because the conversation already holds as many files, images or pages as it can. What the reader wrote and attached stays.',
  },
  composerFilesGone: {
    id: 'conversation.composer.filesGone',
    defaultMessage: 'Some files waited too long to be sent, and are being uploaded again. Send once they are ready.',
    description:
      'Shown above the message field when sending failed because files attached to the message were kept unsent for too long. They upload again by themselves, and the reader sends the message once they have.',
  },
  composerPastedImage: {
    id: 'conversation.composer.pastedImage',
    defaultMessage: 'Pasted image',
    description: 'The name given to an image pasted into the message field that came without a name of its own.',
  },
  composerPastedFile: {
    id: 'conversation.composer.pastedFile',
    defaultMessage: 'Pasted file',
    description: 'The name given to a file pasted into the message field that came without a name of its own.',
  },
  mentionListLabel: {
    id: 'conversation.mention.listLabel',
    defaultMessage: 'Knowledge',
    description:
      "Heading of the list that opens above the message field when the reader types @, suggesting the team's knowledge documents, such as a note or a plan, to mention in the message.",
  },
  mentionEmpty: {
    id: 'conversation.mention.empty',
    defaultMessage: 'No knowledge matches “{query}”',
    description:
      "Shown in the list above the message field when no knowledge document's title holds what the reader typed after @. {query} is what they typed, kept as typed.",
  },
  tooMany: {
    id: 'conversation.tooMany',
    defaultMessage: 'You have {max, number} conversations, as many as you can keep. Delete one to start another.',
    description:
      'Shown when the reader tries to start a conversation while they keep as many as they may. {max} is a number such as 1000.',
  },

  /* ---
    DOCK: conversations open as small windows pinned to the bottom right of the screen, beside
    whatever page the reader is on, each open or minimized to its header
  --- */

  dockLabel: {
    id: 'conversation.dockLabel',
    defaultMessage: 'Docked conversations',
    description:
      'Accessible name of the row of small conversation windows pinned to the bottom right of the screen, beside the page.',
  },
  dockFullPage: {
    id: 'conversation.dockFullPage',
    defaultMessage: 'Full page',
    description:
      "Tooltip of the button in the header of a docked conversation's window that opens the conversation as a whole page instead.",
  },
  dockMinimize: {
    id: 'conversation.dockMinimize',
    defaultMessage: 'Minimize',
    description: "Tooltip of the button in the header of a docked conversation's window that shrinks it to its header.",
  },
  dockClose: {
    id: 'conversation.dockClose',
    defaultMessage: 'Close',
    description:
      "Tooltip of the button in the header of a docked conversation's window that takes it out of the dock. The conversation is kept.",
  },
  dockWorking: {
    id: 'conversation.dockWorking',
    defaultMessage: 'Strategy Dance is working',
    description:
      "Read by screen readers beside the spinner in a minimized conversation window's header, while the AI works on an answer. Strategy Dance is the product's name, and the name of its AI.",
  },
  dockUnread: {
    id: 'conversation.dockUnread',
    defaultMessage: '{count, plural, one {# new message} other {# new messages}}',
    description:
      "Read by screen readers beside the count in a minimized conversation window's header: the AI's messages the reader has not seen yet.",
  },
  dockWaiting: {
    id: 'conversation.dockWaiting',
    defaultMessage: 'Waiting for your answer',
    description:
      "Read by screen readers beside the dot in a minimized conversation window's header, when the AI asked the reader a question there.",
  },
  dockMore: {
    id: 'conversation.dockMore',
    defaultMessage: '+{count, number}',
    description:
      'Button beside the docked conversation windows, for those that do not fit on the screen, which lists them. {count} is how many, such as 3.',
  },
  dockMoreLabel: {
    id: 'conversation.dockMoreLabel',
    defaultMessage: '{count, plural, one {# more docked conversation} other {# more docked conversations}}',
    description:
      'Accessible name of the button beside the docked conversation windows that lists those that do not fit on the screen.',
  },
  dockMoreAttentionLabel: {
    id: 'conversation.dockMoreAttentionLabel',
    defaultMessage:
      '{count, plural, one {# more docked conversation, which needs your attention} other {# more docked conversations, some needing your attention}}',
    description:
      'Accessible name of the button beside the docked conversation windows that lists those that do not fit on the screen, when one of them has new messages or a question for the reader.',
  },
})

export default conversationMessages
