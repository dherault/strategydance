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
    defaultMessage:
      'It shows up on the page of each aspect it is tagged with. Strategy Dance no longer tags it once you do.',
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
  viewOutput: {
    id: 'conversation.viewOutput',
    defaultMessage: 'View output',
    description: 'Button on a tool the AI used, which opens what the tool was given and what it gave back.',
  },
  viewError: {
    id: 'conversation.viewError',
    defaultMessage: 'View error',
    description: 'Button on a tool the AI used that failed, which opens what the tool was given and how it failed.',
  },
  toolCall: {
    id: 'conversation.toolCall',
    defaultMessage: 'Tool call · {name}',
    description:
      "Line under the title of the dialog showing a tool the AI used. {name} is the tool's technical name, such as search_knowledge, kept as it is.",
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
  tooMany: {
    id: 'conversation.tooMany',
    defaultMessage: 'You have {max, number} conversations, as many as you can keep. Delete one to start another.',
    description:
      'Shown when the reader tries to start a conversation while they keep as many as they may. {max} is a number such as 1000.',
  },
})

export default conversationMessages
