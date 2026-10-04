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
    defaultMessage: 'Chats with Strategy Dance. Get ready to be challenged. Only you can see your conversations.',
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
  toolGetTeamRunning: {
    id: 'conversation.tool.getTeam.running',
    defaultMessage: 'Reading your team',
    description: "What the AI is doing while it reads who is in the reader's team and what each works on.",
  },
  toolGetTeamDone: {
    id: 'conversation.tool.getTeam.done',
    defaultMessage: 'Read your team',
    description: "What the AI did once it read who is in the reader's team and what each works on. Past tense.",
  },
  toolReadLogRunning: {
    id: 'conversation.tool.readLog.running',
    defaultMessage: 'Reading the log',
    description: "What the AI is doing while it reads the team's log, the short daily updates its members write.",
  },
  toolReadLogDone: {
    id: 'conversation.tool.readLog.done',
    defaultMessage: 'Read the log',
    description: "What the AI did once it read the team's log, the short daily updates its members write. Past tense.",
  },
  toolSetTopPriorityRunning: {
    id: 'conversation.tool.setTopPriority.running',
    defaultMessage: 'Setting your top priority',
    description: "What the AI is doing while it sets the reader's top priority, the one thing they focus on.",
  },
  toolSetTopPriorityDone: {
    id: 'conversation.tool.setTopPriority.done',
    defaultMessage: 'Set your top priority',
    description: "What the AI did once it set the reader's top priority, the one thing they focus on. Past tense.",
  },
})

export default conversationMessages
