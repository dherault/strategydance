import {
  CONVERSATION_SEARCH_WINDOW_MINUTES,
  MAX_ACTIVE_RUNS_PER_MEMBER,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_SEARCHES,
  MAX_CONVERSATIONS,
} from 'strategydance-core'

import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  The backend connector's conversation operations, over tables kept in memory, for the domain's
  tests, which mock `strategydance-database/backend` with it. Each operation mirrors the conditions
  of its namesake in the connector, in the same order, and throws the same messages, so a test reads
  as the behaviour it checks rather than as a script of answers. `check:conversation-runs` and
  `check:conversation-search` check those conditions against the emulators, which is what keeps the
  two alike: change one with the other. A search matches words and patterns as near as a test
  needs, which the second checks against Postgres' own.

  An operation checks everything before it changes anything, so it applies whole or not at all, as
  a transaction does, and runs without yielding, so two called at once take turns as two locked
  transactions do. `beforeOperation` runs first, which is where a test lets something happen
  meanwhile, a member removed say. Times are the clock's, which a test moves with `setSystemTime`.
  Ids are kept as Data Connect keeps them, dashless
*/

export const ConversationMessageKind = {
  MEMBER_TEXT: 'MEMBER_TEXT',
  AGENT_TEXT: 'AGENT_TEXT',
  TOOL_CALL: 'TOOL_CALL',
  QUESTION: 'QUESTION',
  ASPECTS: 'ASPECTS',
  NOTE: 'NOTE',
} as const

export const ConversationNoteKind = {
  STOPPED: 'STOPPED',
  FAILED: 'FAILED',
  REFUSED: 'REFUSED',
  INTERRUPTED: 'INTERRUPTED',
  FULL: 'FULL',
} as const

export const ConversationRunStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  STOPPED: 'STOPPED',
  FAILED: 'FAILED',
  REFUSED: 'REFUSED',
  INTERRUPTED: 'INTERRUPTED',
  CONTINUED: 'CONTINUED',
} as const

export const ConversationRunTrigger = {
  MESSAGE: 'MESSAGE',
  ANSWER: 'ANSWER',
  RESUME: 'RESUME',
  RETRY: 'RETRY',
} as const

export const ConversationToolStatus = {
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

export const ConversationTranscriptRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const

export type FakeConversation = {
  id: string
  userId: string
  organizationId: string
  title: string
  activeRunId: string | null
  preview: unknown
  previewMessageId: string | null
  unreadCount: number
  nextRunNumber: number
  nextMessagePosition: number
  messageCount: number
  isFull: boolean
  deletedAt: string | null
  pruneClaimedAt: string | null
  updatedAt: string
  // Which aspects of the company it is about, none unless a test says
  aspects?: string[]
  // How many times a retry cut its history, 0 until one does
  historyRevision?: number
  // Whether a question waits for the member, false until a run ends on one
  isAwaitingAnswer?: boolean
}

export type FakeRun = {
  id: string
  conversationId: string
  number: number
  trigger: string
  status: string
  membershipCreatedAt: string
  step: string | null
  anchorPosition: number
  stopRequestedAt: string | null
  leaseExpiresAt: string | null
  attempts: number
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  // Its context message as JSON text, once built, its usage ledger, and why it ended, for the logs
  context?: string | null
  usage?: unknown
  failure?: string | null
  // The results of its turn's calls that finished, as JSON text, until the entry that sends them
  pendingToolResults?: string | null
}

export type FakeMessage = {
  id: string
  conversationId: string
  runId: string | null
  kind: string
  text: string | null
  noteKind: string | null
  toolStatus: string | null
  position: number
  citations?: unknown
  toolUseId?: string | null
  toolName?: string | null
  toolInput?: string | null
  toolOutput?: string | null
  toolStartedAt?: string | null
  toolDurationMs?: number | null
  questionPrompt?: string | null
  questionOptions?: string[] | null
  isMultipleChoice?: boolean | null
  answerSelected?: string[] | null
  answerOther?: string | null
  isAnswerSkipped?: boolean
  answeredAt?: string | null
}

export type FakeEntry = {
  id: string
  conversationId: string
  runId: string
  position: number
  role: string
  content: string
  drawnBlocks: number
  // The cursor's piece within a text drawn in pieces
  drawnPieces?: number
  contextHash?: string | null
}

// What a member's account and membership tell the context message, which a test can change
export type FakeUser = {
  isAdministrator: boolean
  displayName: string | null
  timezone: string | null
  locale: string
  bio: string | null
}

export type FakeMembership = {
  createdAt: string
  role: string
  jobTitle: string | null
}

// A search somebody made of their conversations, which counts against their allowance
export type FakeSearch = {
  id: string
  userId: string
  organizationId: string
  createdAt: string
}

export type FakeOrganization = {
  name: string
  brief: string | null
  exploredAspects: string[]
}

type Variables = Record<string, unknown>

// What a test reads the variables of an operation as
type AnyVariables = Record<string, any>

const RUN_IN_FLIGHT = ['QUEUED', 'RUNNING']

// The messages a search reads, the member's and the agent's, and never a question or a note
const SEARCHED_KINDS = ['MEMBER_TEXT', 'AGENT_TEXT']

function createConversationDatabaseFake() {
  const users = new Map<string, FakeUser>()
  const memberships = new Map<string, FakeMembership>()
  const organizations = new Map<string, FakeOrganization>()
  const conversations = new Map<string, FakeConversation>()
  const runs = new Map<string, FakeRun>()
  const messages = new Map<string, FakeMessage>()
  const entries = new Map<string, FakeEntry>()
  const searches = new Map<string, FakeSearch>()
  // Every operation called, by name, in order
  const calls: string[] = []
  let stamps = 0

  const fake = {
    users,
    memberships,
    organizations,
    conversations,
    runs,
    messages,
    entries,
    searches,
    calls,
    beforeOperation: async (_name: string, _variables: AnyVariables): Promise<void> => {},
  }

  function now() {
    return new Date().toISOString()
  }

  // A time no other stamp shares, as a membership's `createdAt` is in Postgres, to the microsecond
  function stamp() {
    stamps++

    return now().replace('Z', `${String(stamps % 1000).padStart(3, '0')}Z`)
  }

  function inSeconds(seconds: number) {
    return new Date(Date.now() + seconds * 1000).toISOString()
  }

  function isPast(time: string | null) {
    return time !== null && Date.parse(time) < Date.now()
  }

  function id(value: unknown) {
    return toCanonicalUuid(String(value))
  }

  function membershipKey(userId: unknown, organizationId: unknown) {
    return `${userId}:${id(organizationId)}`
  }

  function refuse(message: string): never {
    throw new Error(message)
  }

  function addMember(userId: string, organizationId: string, { isAdministrator = true } = {}) {
    if (!users.has(userId)) {
      users.set(userId, { isAdministrator, displayName: null, timezone: null, locale: 'EN', bio: null })
    }

    if (!organizations.has(id(organizationId))) {
      organizations.set(id(organizationId), { name: 'Checked organization', brief: null, exploredAspects: [] })
    }

    const createdAt = stamp()

    memberships.set(membershipKey(userId, organizationId), { createdAt, role: 'MEMBER', jobTitle: null })

    return createdAt
  }

  function removeMember(userId: string, organizationId: string) {
    memberships.delete(membershipKey(userId, organizationId))
  }

  // Whether a conversation was deleted over a day ago, past its Undo
  function isPastUndo(conversation: FakeConversation) {
    return conversation.deletedAt !== null && Date.parse(conversation.deletedAt) < Date.now() - 24 * 60 * 60 * 1000
  }

  // Deletes a conversation with what cascades from it: its runs, messages and transcript
  function deleteConversation(conversationId: string) {
    conversations.delete(conversationId)

    for (const table of [runs, messages, entries]) {
      for (const row of table.values()) {
        if (row.conversationId === conversationId) table.delete(row.id)
      }
    }
  }

  /*
    The web connector's `RestoreConversation`, as far as a sweep meets it: a deleted conversation of
    the caller's comes back only while no sweep has claimed it, and is refused as the connector
    refuses it otherwise. The membership's lock and the count of 1000 are left to its own checks
  */
  function restore(conversationId: string, userId: string, organizationId: string) {
    const conversation = conversations.get(id(conversationId))

    if (
      !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== id(organizationId)
      || conversation.deletedAt === null
      || conversation.pruneClaimedAt !== null
    ) {
      refuse('The conversation is gone for good')
    }

    conversation.deletedAt = null
  }

  // The web's `MarkConversationRead`: nothing unread, only while the preview the page rendered is
  // still the conversation's, so a reply that landed meanwhile stays unread
  function markRead(conversationId: string, previewMessageId: string) {
    const conversation = conversations.get(id(conversationId))

    if (
      conversation
      && conversation.deletedAt === null
      && conversation.previewMessageId === id(previewMessageId)
      && conversation.unreadCount > 0
    ) {
      conversation.unreadCount = 0
    }
  }

  // The messages the runs on an anchor drew, the member's that started one aside, as a retry
  // deletes them
  function drawnOnAnchor(conversationId: string, anchorPosition: unknown) {
    return [...messages.values()].filter(
      message =>
        message.conversationId === conversationId
        && message.kind !== 'MEMBER_TEXT'
        && message.runId !== null
        && runs.get(message.runId)?.anchorPosition === anchorPosition,
    )
  }

  function runsInFlight(userId: unknown, organizationId: unknown) {
    return [...runs.values()].filter(run => {
      const conversation = conversations.get(run.conversationId)

      return (
        RUN_IN_FLIGHT.includes(run.status)
        && conversation !== undefined
        && conversation.userId === userId
        && conversation.organizationId === id(organizationId)
      )
    })
  }

  // The caller's conversations in the organization, deleted ones aside
  function keptConversations(variables: AnyVariables) {
    return [...conversations.values()].filter(
      conversation =>
        conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
        && conversation.deletedAt === null,
    )
  }

  // The caller's searches in an organization in the last ten minutes, newest first
  function recentSearches(userId: unknown, organizationId: unknown) {
    const since = Date.now() - CONVERSATION_SEARCH_WINDOW_MINUTES * 60 * 1000

    return [...searches.values()]
      .filter(
        search =>
          search.userId === userId
          && search.organizationId === id(organizationId)
          && Date.parse(search.createdAt) > since,
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }

  // The conversations a search reads: the caller's own in the organization, while they are a member
  // of it, and none deleted
  function searchedConversations(variables: AnyVariables) {
    if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) return []

    return keptConversations(variables)
  }

  // The searched messages, by their conversation's id
  function searchedMessages(conversationIds: Set<string>) {
    const byConversation = new Map<string, FakeMessage[]>()

    for (const message of messages.values()) {
      if (
        !conversationIds.has(message.conversationId)
        || !SEARCHED_KINDS.includes(message.kind)
        || message.text === null
      ) {
        continue
      }

      byConversation.set(message.conversationId, [...(byConversation.get(message.conversationId) ?? []), message])
    }

    return byConversation
  }

  // The words the `simple` configuration finds in a text, as near as a test needs: lowercased, split
  // on anything that is neither a letter nor a digit
  function splitWords(text: string) {
    return text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
  }

  // How often a text holds the words of a query, which stands for its relevance, or 0 unless it
  // holds every one of them, as `PLAIN` requires
  function scoreMatch(text: string, query: string) {
    const words = splitWords(text)
    const counts = splitWords(query).map(term => words.filter(word => word === term).length)

    return counts.length && counts.every(count => count > 0) ? counts.reduce((sum, count) => sum + count, 0) : 0
  }

  // Whether a text matches a LIKE pattern ignoring case: `%` any run of characters, `_` any one, and
  // `\` making the character after it itself
  function matchesLike(text: string, pattern: string) {
    let source = ''

    for (let index = 0; index < pattern.length; index++) {
      const character = pattern[index]!

      if (character === '\\') source += (pattern[++index] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      else if (character === '%') source += '.*'
      else if (character === '_') source += '.'
      else source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    return new RegExp(`^${source}$`, 'isu').test(text)
  }

  function conversationMessages(conversationId: string) {
    return [...messages.values()].filter(message => message.conversationId === conversationId)
  }

  // The questions of a conversation still waiting for an answer, which only the turn its transcript
  // ends on can hold
  function waitingQuestions(conversationId: string) {
    return conversationMessages(conversationId).filter(
      message => message.kind === 'QUESTION' && (message.answeredAt ?? null) === null,
    )
  }

  // A conversation's runs, latest first
  function latestRuns(conversationId: string) {
    return [...runs.values()].filter(run => run.conversationId === conversationId).sort((a, b) => b.number - a.number)
  }

  // Cancels the calls still running in a conversation, which only its run in flight can have
  function cancelRunningCalls(conversationId: string) {
    for (const message of conversationMessages(conversationId)) {
      if (message.kind === 'TOOL_CALL' && message.toolStatus === 'RUNNING') message.toolStatus = 'CANCELLED'
    }
  }

  // A run queued as a member's action queues one, anchored on the transcript entry it answers
  function queuedRun(
    runId: string,
    conversationId: string,
    variables: AnyVariables,
    trigger: string,
    anchorPosition: number,
  ): FakeRun {
    return {
      id: runId,
      conversationId,
      number: variables.runNumber,
      trigger,
      status: 'QUEUED',
      membershipCreatedAt: variables.membershipCreatedAt,
      step: null,
      anchorPosition,
      stopRequestedAt: null,
      leaseExpiresAt: inSeconds(20 * 60),
      attempts: 0,
      createdAt: now(),
      startedAt: null,
      endedAt: null,
      pendingToolResults: null,
    }
  }

  function conversationEntries(conversationId: string) {
    return [...entries.values()]
      .filter(entry => entry.conversationId === conversationId)
      .sort((a, b) => b.position - a.position)
  }

  function insertMessage(message: FakeMessage) {
    if (messages.has(message.id)) refuse('violates SQL unique constraint: conversation_message_pkey')
    if (conversationMessages(message.conversationId).some(({ position }) => position === message.position)) {
      refuse('violates SQL unique constraint: conversation_message_conversation_id_position_uidx')
    }

    messages.set(message.id, message)
  }

  // Refuses an entry its table's keys would, without inserting it, so a mutation inserting two
  // checks both before it changes anything
  function checkEntry(entry: FakeEntry) {
    if (entries.has(entry.id)) refuse('violates SQL unique constraint: conversation_transcript_entry_pkey')
    if (conversationEntries(entry.conversationId).some(({ position }) => position === entry.position)) {
      refuse('violates SQL unique constraint: conversation_transcript_entry_conversation_id_position_uidx')
    }
  }

  function insertEntry(entry: FakeEntry) {
    checkEntry(entry)

    entries.set(entry.id, { drawnPieces: 0, contextHash: null, ...entry })
  }

  // The conversation a drawn message goes into, at the counter and not deleted
  function requireDrawConversation(variables: AnyVariables) {
    const conversation = conversations.get(id(variables.conversationId))

    if (!conversation || conversation.deletedAt !== null || conversation.nextMessagePosition !== variables.position) {
      refuse('The conversation could not take the message at that position')
    }

    return conversation
  }

  // The transcript entry a drawn message moves the cursor of, at the cursor the worker read
  function requireDrawEntry(run: FakeRun, variables: AnyVariables) {
    const entry = entries.get(id(variables.entryId))

    if (
      !entry
      || entry.conversationId !== run.conversationId
      || entry.drawnBlocks !== variables.fromBlock
      || (entry.drawnPieces ?? 0) !== 0
    ) {
      refuse('Those blocks were drawn already')
    }

    return entry
  }

  // Writes the optional variables an operation names into its row, leaving those omitted as they
  // were, as Data Connect does
  function assignGiven<Row extends object>(row: Row, values: Partial<Row>) {
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) Object.assign(row, { [key]: value })
    }
  }

  // The fence of every write of a worker, as `RenewConversationRunLease` holds it, and the claim's,
  // which holds it with the run queued
  function findFencedRun(variables: AnyVariables, status = 'RUNNING') {
    const run = runs.get(id(variables.runId))
    const conversation = run && conversations.get(run.conversationId)
    const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

    if (
      !run
      || !conversation
      || run.status !== status
      || run.attempts !== variables.attempts
      || run.membershipCreatedAt !== variables.membershipCreatedAt
      || conversation.id !== id(variables.conversationId)
      || conversation.userId !== variables.userId
      || conversation.organizationId !== id(variables.organizationId)
      || membership?.createdAt !== variables.membershipCreatedAt
    ) {
      return null
    }

    return run
  }

  // A run still queued in the caller's conversation, as the queued run's lease mutations match it
  function findQueuedRun(variables: AnyVariables) {
    return findOwnedRun(variables, 'QUEUED')
  }

  // A run of the caller's conversation in that status, as the queued-run operations find theirs
  function findOwnedRun(variables: AnyVariables, status?: string) {
    const run = runs.get(id(variables.runId))
    const conversation = run && conversations.get(run.conversationId)

    if (
      !run
      || !conversation
      || (status !== undefined && run.status !== status)
      || conversation.id !== id(variables.conversationId)
      || conversation.userId !== variables.userId
      || conversation.organizationId !== id(variables.organizationId)
    ) {
      return null
    }

    return run
  }

  function requireFencedRun(variables: AnyVariables) {
    return findFencedRun(variables) ?? refuse("The run is no longer this worker's")
  }

  // The conversation a note goes into, at the counter, naming the run or none, as the connector's
  // note steps hold it
  function requireNoteConversation(variables: AnyVariables) {
    const conversation = conversations.get(id(variables.conversationId))

    if (
      !conversation
      || conversation.nextMessagePosition !== variables.position
      || (conversation.activeRunId !== null && conversation.activeRunId !== id(variables.runId))
    ) {
      refuse('The conversation could not take the note at that position')
    }

    return conversation
  }

  function writeNote(conversation: FakeConversation, variables: AnyVariables, noteKind: string) {
    const runId = id(variables.runId)

    insertMessage({
      id: id(variables.noteId),
      conversationId: conversation.id,
      runId,
      kind: 'NOTE',
      text: null,
      noteKind,
      toolStatus: null,
      position: variables.position,
    })

    cancelRunningCalls(conversation.id)

    Object.assign(conversation, {
      activeRunId: null,
      preview: variables.preview,
      previewMessageId: id(variables.noteId),
      nextMessagePosition: conversation.nextMessagePosition + 1,
      messageCount: conversation.messageCount + 1,
      updatedAt: now(),
    })
  }

  function end(run: FakeRun, status: string) {
    Object.assign(run, { status, endedAt: now(), leaseExpiresAt: null })
  }

  // The membership lock and the counts `StartConversation` and `SendConversationMessage` share
  function checkStart(variables: AnyVariables) {
    if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) {
      refuse('Only a member of an organization can keep conversations in it')
    }

    if (
      memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
      !== variables.membershipCreatedAt
    ) {
      refuse('The membership changed since the send read it')
    }

    if (messages.has(id(variables.messageId))) refuse('The message was sent already')

    if (runsInFlight(variables.userId, variables.organizationId).length >= MAX_ACTIVE_RUNS_PER_MEMBER) {
      refuse('Somebody has at most 3 runs in flight in an organization')
    }
  }

  // The conversation a send goes into, after the membership's lock and counts: the caller's, not
  // deleted, idle, not full, at the counters the send read
  function requireSendConversation(variables: AnyVariables) {
    const conversation = conversations.get(id(variables.conversationId))

    checkStart(variables)

    if (
      !conversation
      || conversation.userId !== variables.userId
      || conversation.organizationId !== id(variables.organizationId)
      || conversation.deletedAt !== null
      || conversation.activeRunId !== null
      || conversation.isFull
      || conversation.messageCount >= MAX_CONVERSATION_MESSAGES
      || conversation.nextMessagePosition !== variables.position
      || conversation.nextRunNumber !== variables.runNumber
    ) {
      refuse('The conversation could not take the message')
    }

    return conversation
  }

  // The keys a send's run and entry take, checked before anything is written
  function checkSend(conversation: FakeConversation, variables: AnyVariables) {
    if (runs.has(id(variables.runId))) refuse('violates SQL unique constraint: conversation_run_pkey')
    if (conversationEntries(conversation.id).some(({ position }) => position === variables.transcriptPosition)) {
      refuse('violates SQL unique constraint: conversation_transcript_entry_conversation_id_position_uidx')
    }
  }

  // A send's writes: the conversation takes the message and its run, then the run, the message
  // and its entry
  function writeSend(conversation: FakeConversation, variables: AnyVariables) {
    const runId = id(variables.runId)

    Object.assign(conversation, {
      activeRunId: runId,
      preview: variables.preview,
      previewMessageId: id(variables.messageId),
      nextMessagePosition: conversation.nextMessagePosition + 1,
      nextRunNumber: conversation.nextRunNumber + 1,
      messageCount: conversation.messageCount + 1,
      updatedAt: now(),
    })
    runs.set(runId, queuedRun(runId, conversation.id, variables, 'MESSAGE', variables.transcriptPosition))
    insertMessage({
      id: id(variables.messageId),
      conversationId: conversation.id,
      runId,
      kind: 'MEMBER_TEXT',
      text: variables.text,
      noteKind: null,
      toolStatus: null,
      position: variables.position,
    })
    insertEntry({
      id: crypto.randomUUID().replaceAll('-', ''),
      conversationId: conversation.id,
      runId,
      position: variables.transcriptPosition,
      role: 'USER',
      content: variables.content,
      drawnBlocks: 0,
    })
  }

  const operations: Record<string, (variables: AnyVariables) => unknown> = {
    GetUserStaffStatus: ({ userId }) => ({ user: users.get(userId) ?? null }),

    GetConversationSendContext: variables => {
      const conversation = conversations.get(id(variables.conversationId))
      const message = messages.get(id(variables.messageId))
      const messageConversation = message && conversations.get(message.conversationId)
      const messageRun = message?.runId ? runs.get(message.runId) : undefined
      const lastEntry = conversationEntries(id(variables.conversationId))[0]

      return {
        userOrganization: memberships.get(membershipKey(variables.userId, variables.organizationId)) ?? null,
        conversation: conversation ? { ...conversation } : null,
        conversationTranscriptEntries: lastEntry
          ? [{ id: lastEntry.id, position: lastEntry.position, role: lastEntry.role, content: lastEntry.content }]
          : [],
        latestRuns:
          conversation
          && conversation.userId === variables.userId
          && conversation.organizationId === id(variables.organizationId)
            ? latestRuns(conversation.id)
                .slice(0, 1)
                .map(run => ({ id: run.id, status: run.status }))
            : [],
        conversationMessages:
          message && messageConversation
            ? [
                {
                  kind: message.kind,
                  conversation: {
                    id: messageConversation.id,
                    userId: messageConversation.userId,
                    organizationId: messageConversation.organizationId,
                  },
                  run: messageRun
                    ? { id: messageRun.id, status: messageRun.status, leaseExpiresAt: messageRun.leaseExpiresAt }
                    : null,
                },
              ]
            : [],
        conversationRuns: runsInFlight(variables.userId, variables.organizationId).map(run => ({
          id: run.id,
          status: run.status,
          leaseExpiresAt: run.leaseExpiresAt,
          conversation: { id: run.conversationId },
        })),
        keptConversations: [{ _count: keptConversations(variables).length }],
      }
    },

    GetConversationRunContext: variables => {
      const run = runs.get(id(variables.runId))
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        run
        && conversation
        && run.conversationId === conversation.id
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const lastEntry = conversationEntries(id(variables.conversationId))[0]

      return {
        conversationRuns: isTheirs ? [{ context: null, usage: null, ...run }] : [],
        conversation: conversation ? { ...conversation } : null,
        userOrganization: memberships.get(membershipKey(variables.userId, variables.organizationId)) ?? null,
        user: users.get(variables.userId) ?? null,
        conversationTranscriptEntries: lastEntry
          ? [{ drawnPieces: 0, ...lastEntry, run: { id: lastEntry.runId } }]
          : [],
        runEntries: conversationEntries(id(variables.conversationId))
          .filter(entry => entry.runId === id(variables.runId) && entry.role === 'ASSISTANT')
          .sort((a, b) => b.position - a.position)
          .slice(0, 10)
          .map(({ id: entryId, position, content, drawnBlocks, drawnPieces }) => ({
            id: entryId,
            position,
            content,
            drawnBlocks,
            drawnPieces: drawnPieces ?? 0,
          })),
        conversationMessages: [...messages.values()]
          .filter(message => message.runId === id(variables.runId) && message.kind !== 'MEMBER_TEXT')
          .slice(0, 100)
          .map(({ id: messageId, kind, noteKind, toolStatus }) => ({ id: messageId, kind, noteKind, toolStatus })),
      }
    },

    GetConversationRunStop: variables => {
      const run = findOwnedRun(variables)

      return {
        conversationRuns: run ? [{ status: run.status, stopRequestedAt: run.stopRequestedAt }] : [],
      }
    },

    GetConversationRunLedgers: variables => {
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        conversation !== undefined
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const runIds = new Set((variables.runIds as string[]).map(id))

      return {
        conversationRuns: isTheirs
          ? [...runs.values()]
              .filter(run => runIds.has(run.id) && run.conversationId === conversation.id)
              .slice(0, 100)
              .map(run => ({ id: run.id, usage: run.usage ?? null }))
          : [],
      }
    },

    GetConversationRunControlContext: variables => {
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        conversation !== undefined
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const conversationRuns = isTheirs
        ? [...runs.values()].filter(run => run.conversationId === conversation.id).sort((a, b) => b.number - a.number)
        : []
      const conversationMessages = isTheirs
        ? [...messages.values()]
            .filter(message => message.conversationId === conversation.id)
            .sort((a, b) => b.position - a.position)
        : []
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

      return {
        userOrganization: membership ? { createdAt: membership.createdAt } : null,
        conversation: conversation ? { historyRevision: 0, ...conversation } : null,
        latestRuns: conversationRuns
          .slice(0, 2)
          .map(({ id: runId, number, trigger, status, anchorPosition, leaseExpiresAt, pendingToolResults }) => ({
            id: runId,
            number,
            trigger,
            status,
            anchorPosition,
            leaseExpiresAt,
            pendingToolResults: pendingToolResults ?? null,
          })),
        conversationRuns: runsInFlight(variables.userId, variables.organizationId)
          .slice(0, 3)
          .map(run => ({
            id: run.id,
            status: run.status,
            leaseExpiresAt: run.leaseExpiresAt,
            conversation: { id: run.conversationId },
          })),
        latestMessages: conversationMessages
          .filter(message => message.kind !== 'ASPECTS')
          .slice(0, 2)
          .map(message => ({
            id: message.id,
            kind: message.kind,
            position: message.position,
            text: message.text,
            noteKind: message.noteKind,
            toolName: message.toolName ?? null,
            toolStatus: message.toolStatus,
            questionPrompt: message.questionPrompt ?? null,
            answerSelected: message.answerSelected ?? null,
            answerOther: message.answerOther ?? null,
            isAnswerSkipped: message.isAnswerSkipped ?? false,
            run: message.runId ? { id: message.runId } : null,
          })),
        newestMessages: conversationMessages.slice(0, 1).map(message => ({ id: message.id })),
      }
    },

    GetConversationCalls: variables => {
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        conversation !== undefined
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const toolUseIds = new Set(variables.toolUseIds as string[])

      return {
        conversationMessages: isTheirs
          ? conversationMessages(conversation.id)
              .filter(
                message => ['TOOL_CALL', 'QUESTION'].includes(message.kind) && toolUseIds.has(message.toolUseId ?? ''),
              )
              .sort((a, b) => a.position - b.position)
              .slice(0, 1000)
              .map(message => ({
                id: message.id,
                kind: message.kind,
                toolUseId: message.toolUseId ?? null,
                toolName: message.toolName ?? null,
                toolStatus: message.toolStatus,
                toolOutput: message.toolOutput ?? null,
                toolStartedAt: message.toolStartedAt ?? null,
                questionOptions: message.questionOptions ?? null,
                isMultipleChoice: message.isMultipleChoice ?? null,
                answerSelected: message.answerSelected ?? null,
                answerOther: message.answerOther ?? null,
                isAnswerSkipped: message.isAnswerSkipped ?? false,
                answeredAt: message.answeredAt ?? null,
              }))
          : [],
        latestRuns: isTheirs
          ? latestRuns(conversation.id)
              .slice(0, 1)
              .map(run => ({ id: run.id, status: run.status, pendingToolResults: run.pendingToolResults ?? null }))
          : [],
      }
    },

    GetConversationTurnContext: variables => {
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        conversation !== undefined
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))
      const lastEntry = isTheirs ? conversationEntries(conversation.id)[0] : undefined

      return {
        userOrganization: membership ? { createdAt: membership.createdAt } : null,
        conversation: conversation ? { isAwaitingAnswer: false, ...conversation } : null,
        latestRuns: isTheirs
          ? latestRuns(conversation.id)
              .slice(0, 2)
              .map(({ id: runId, number, trigger, status, leaseExpiresAt }) => ({
                id: runId,
                number,
                trigger,
                status,
                leaseExpiresAt,
              }))
          : [],
        conversationRuns: runsInFlight(variables.userId, variables.organizationId)
          .slice(0, 3)
          .map(run => ({
            id: run.id,
            status: run.status,
            leaseExpiresAt: run.leaseExpiresAt,
            conversation: { id: run.conversationId },
          })),
        conversationTranscriptEntries: lastEntry
          ? [{ id: lastEntry.id, position: lastEntry.position, role: lastEntry.role, content: lastEntry.content }]
          : [],
        waitingQuestions: isTheirs
          ? waitingQuestions(conversation.id)
              .slice(0, 1000)
              .map(message => ({ id: message.id }))
          : [],
      }
    },

    GetConversationQuestion: variables => {
      const message = messages.get(id(variables.messageId))
      const conversation = message && conversations.get(message.conversationId)
      const isTheirs =
        conversation !== undefined
        && conversation.id === id(variables.conversationId)
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)

      return {
        conversationMessages:
          message && isTheirs
            ? [
                {
                  id: message.id,
                  kind: message.kind,
                  toolUseId: message.toolUseId ?? null,
                  questionPrompt: message.questionPrompt ?? null,
                  questionOptions: message.questionOptions ?? null,
                  isMultipleChoice: message.isMultipleChoice ?? null,
                  answerSelected: message.answerSelected ?? null,
                  answerOther: message.answerOther ?? null,
                  isAnswerSkipped: message.isAnswerSkipped ?? false,
                  answeredAt: message.answeredAt ?? null,
                },
              ]
            : [],
      }
    },

    GetConversationRetryContext: variables => {
      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
      ) {
        return { anchorRuns: [], drawnMessages: [{ _count: 0 }], drawnRuns: [], keptMessages: [] }
      }

      const drawn = new Set(drawnOnAnchor(conversation.id, variables.anchorPosition))
      const kept = [...messages.values()]
        .filter(
          message => message.conversationId === conversation.id && message.kind !== 'ASPECTS' && !drawn.has(message),
        )
        .sort((a, b) => b.position - a.position)

      return {
        anchorRuns: [...runs.values()]
          .filter(run => run.conversationId === conversation.id && run.anchorPosition === variables.anchorPosition)
          .sort((a, b) => b.number - a.number)
          .slice(0, 100)
          .map(run => ({ id: run.id })),
        drawnMessages: [{ _count: drawn.size }],
        drawnRuns: [...drawn]
          .sort((a, b) => b.position - a.position)
          .slice(0, 5000)
          .map(message => ({ run: message.runId ? { id: message.runId } : null })),
        keptMessages: kept.slice(0, 1).map(message => ({
          id: message.id,
          kind: message.kind,
          text: message.text,
          noteKind: message.noteKind,
          toolName: message.toolName ?? null,
          toolStatus: message.toolStatus,
          questionPrompt: message.questionPrompt ?? null,
          answerSelected: message.answerSelected ?? null,
          answerOther: message.answerOther ?? null,
          isAnswerSkipped: message.isAnswerSkipped ?? false,
        })),
      }
    },

    GetConversationTranscript: variables => {
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        conversation
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)

      return {
        conversationTranscriptEntries: isTheirs
          ? conversationEntries(conversation.id)
              .filter(entry => entry.position > variables.afterPosition)
              .sort((a, b) => a.position - b.position)
              .slice(0, 100)
              .map(entry => ({
                id: entry.id,
                position: entry.position,
                role: entry.role,
                content: entry.content,
                contextHash: entry.contextHash ?? null,
                drawnBlocks: entry.drawnBlocks,
                drawnPieces: entry.drawnPieces ?? 0,
                run: { id: entry.runId },
              }))
          : [],
      }
    },

    GetConversationRequestContext: variables => {
      const user = users.get(variables.userId)
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))
      const organization = organizations.get(id(variables.organizationId))
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        conversation
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)

      return {
        user: user
          ? { displayName: user.displayName, timezone: user.timezone, locale: user.locale, bio: user.bio }
          : null,
        userOrganization: membership ? { role: membership.role, jobTitle: membership.jobTitle } : null,
        organization: organization ? { ...organization } : null,
        conversations: isTheirs ? [{ aspects: conversation.aspects ?? [] }] : [],
        conversationRuns: isTheirs
          ? [...runs.values()]
              .filter(run => run.conversationId === conversation.id)
              .sort((a, b) => b.number - a.number)
              .slice(0, 20)
              .map(run => ({ id: run.id, usage: run.usage ?? null }))
          : [],
      }
    },

    StartConversation: variables => {
      const conversationId = id(variables.conversationId)
      const runId = id(variables.runId)

      checkStart(variables)

      if (conversations.has(conversationId)) refuse('The conversation exists already')

      if (keptConversations(variables).length >= MAX_CONVERSATIONS)
        refuse('Somebody keeps at most 1000 conversations in an organization')
      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      // Deleting from a map while iterating it visits every entry left once
      for (const conversation of conversations.values()) {
        if (
          conversation.userId === variables.userId
          && conversation.organizationId === id(variables.organizationId)
          && isPastUndo(conversation)
        ) {
          deleteConversation(conversation.id)
        }
      }

      conversations.set(conversationId, {
        id: conversationId,
        userId: variables.userId,
        organizationId: id(variables.organizationId),
        title: variables.title,
        activeRunId: runId,
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        unreadCount: 0,
        nextRunNumber: 1,
        nextMessagePosition: 1,
        messageCount: 1,
        isFull: false,
        isAwaitingAnswer: false,
        deletedAt: null,
        pruneClaimedAt: null,
        updatedAt: now(),
      })
      runs.set(runId, {
        id: runId,
        conversationId,
        number: 0,
        trigger: 'MESSAGE',
        status: 'QUEUED',
        membershipCreatedAt: variables.membershipCreatedAt,
        step: null,
        anchorPosition: 0,
        stopRequestedAt: null,
        leaseExpiresAt: inSeconds(20 * 60),
        attempts: 0,
        createdAt: now(),
        startedAt: null,
        endedAt: null,
      })
      insertMessage({
        id: id(variables.messageId),
        conversationId,
        runId,
        kind: 'MEMBER_TEXT',
        text: variables.text,
        noteKind: null,
        toolStatus: null,
        position: 0,
      })
      insertEntry({
        id: crypto.randomUUID().replaceAll('-', ''),
        conversationId,
        runId,
        position: 0,
        role: 'USER',
        content: variables.content,
        drawnBlocks: 0,
      })

      return { conversation_insert: { id: conversationId } }
    },

    SendConversationMessage: variables => {
      const conversation = requireSendConversation(variables)

      checkSend(conversation, variables)
      writeSend(conversation, variables)

      return { conversation_updateMany: 1 }
    },

    SendConversationMessageAnsweringCalls: variables => {
      const conversation = requireSendConversation(variables)
      const lastRun = runs.get(id(variables.lastRunId))
      const isLastRunWaiting =
        lastRun !== undefined && lastRun.status === 'WAITING' && lastRun.conversationId === conversation.id

      if (Number(isLastRunWaiting) !== (variables.isLastRunWaiting ? 1 : 0)) {
        refuse('The last run no longer waits as the send read it')
      }

      const skippedIds = new Set((variables.skippedQuestionIds as string[]).map(id))
      const skipped = waitingQuestions(conversation.id).filter(message => skippedIds.has(message.id))

      if (skipped.length !== skippedIds.size) refuse('The questions changed since the send read them')

      checkSend(conversation, variables)

      if (lastRun && isLastRunWaiting) lastRun.status = 'CONTINUED'

      for (const message of skipped) Object.assign(message, { isAnswerSkipped: true, answeredAt: now() })

      conversation.isAwaitingAnswer = false
      writeSend(conversation, variables)

      return { conversation_updateMany: 1 }
    },

    AnswerConversationQuestion: variables => {
      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.deletedAt !== null
        || !conversation.isAwaitingAnswer
        || conversation.previewMessageId !== id(variables.previewMessageId)
      ) {
        refuse('The conversation waits for no answer, or its preview moved')
      }

      const other = variables.answerOther ?? null

      if (
        variables.answerSelected.length > 6
        || (other !== null && [...other].length > 500)
        || (!variables.answerSelected.length && other === null)
      ) {
        refuse('An answer chooses at most 6 options, or says something in at most 500 characters')
      }

      const waiting = runs.get(id(variables.runId))

      if (!waiting || waiting.status !== 'WAITING' || waiting.conversationId !== conversation.id) {
        refuse('The run no longer waits for an answer')
      }

      const question = messages.get(id(variables.messageId))

      if (
        !question
        || question.conversationId !== conversation.id
        || question.kind !== 'QUESTION'
        || (question.answeredAt ?? null) !== null
      ) {
        refuse('The question waits no more')
      }

      assignGiven(conversation, { preview: variables.preview })
      conversation.updatedAt = now()
      Object.assign(question, { answerSelected: variables.answerSelected, answeredAt: now() })
      assignGiven(question, { answerOther: variables.answerOther })

      return {
        conversation_updateMany: 1,
        conversationMessage_updateMany: 1,
        left: {
          conversationMessages: waitingQuestions(conversation.id)
            .slice(0, 1000)
            .map(message => ({ id: message.id })),
        },
      }
    },

    ContinueConversationRun: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

      if (!membership) refuse('Only a member of an organization can keep conversations in it')
      if (membership.createdAt !== variables.membershipCreatedAt) {
        refuse('The membership changed since the continuation read it')
      }

      if (runsInFlight(variables.userId, variables.organizationId).length >= MAX_ACTIVE_RUNS_PER_MEMBER) {
        refuse('Somebody has at most 3 runs in flight in an organization')
      }

      const conversationId = id(variables.conversationId)

      if (waitingQuestions(conversationId).length) refuse('A question of the turn still waits')

      const conversation = conversations.get(conversationId)
      const waiting = runs.get(id(variables.waitingRunId))

      if (
        !waiting
        || !conversation
        || waiting.status !== 'WAITING'
        || waiting.conversationId !== conversation.id
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
      ) {
        refuse("The run's turn was consumed already")
      }

      if (
        conversation.deletedAt !== null
        || conversation.activeRunId !== null
        || conversation.nextRunNumber !== variables.runNumber
      ) {
        refuse('The conversation could not take the run')
      }

      const runId = id(variables.runId)

      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      const entry: FakeEntry = {
        id: crypto.randomUUID().replaceAll('-', ''),
        conversationId,
        runId,
        position: variables.transcriptPosition,
        role: 'USER',
        content: variables.content,
        drawnBlocks: 0,
      }

      checkEntry(entry)

      waiting.status = 'CONTINUED'
      Object.assign(conversation, {
        activeRunId: runId,
        isAwaitingAnswer: false,
        nextRunNumber: conversation.nextRunNumber + 1,
        updatedAt: now(),
      })
      runs.set(runId, queuedRun(runId, conversationId, variables, 'ANSWER', variables.transcriptPosition))
      insertEntry(entry)

      return { conversation_updateMany: 1 }
    },

    InterruptDeadConversationRun: variables => {
      const run = runs.get(id(variables.runId))
      const conversation = run && conversations.get(run.conversationId)

      if (
        !run
        || !conversation
        || !RUN_IN_FLIGHT.includes(run.status)
        || !isPast(run.leaseExpiresAt)
        || conversation.id !== id(variables.conversationId)
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
      ) {
        refuse('The run is not dead')
      }

      const noteConversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'INTERRUPTED')
      assignGiven(run, { failure: variables.failure })
      writeNote(noteConversation, variables, 'INTERRUPTED')

      return { conversationRun_updateMany: 1 }
    },

    RenewQueuedConversationRunLease: variables => {
      const run = findQueuedRun(variables)

      if (!run) return { conversationRun_updateMany: 0 }

      run.leaseExpiresAt = inSeconds(20 * 60)

      return { conversationRun_updateMany: 1 }
    },

    ExpireQueuedConversationRunLease: variables => {
      const run = findQueuedRun(variables)

      if (!run) return { conversationRun_updateMany: 0 }

      run.leaseExpiresAt = now()

      return { conversationRun_updateMany: 1 }
    },

    RequestConversationRunStop: variables => {
      const run = findOwnedRun(variables, 'RUNNING')

      if (!run || run.stopRequestedAt) return { conversationRun_updateMany: 0 }

      run.stopRequestedAt = now()

      return { conversationRun_updateMany: 1 }
    },

    StopQueuedConversationRun: variables => {
      const run = findQueuedRun(variables)

      if (!run) refuse('The run is no longer queued')

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'STOPPED')
      run.failure = 'Its member stopped it while it was queued'
      writeNote(conversation, variables, 'STOPPED')

      return { conversationRun_updateMany: 1 }
    },

    ResumeConversationRun: variables => {
      if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) {
        refuse('Only a member of an organization can keep conversations in it')
      }

      if (
        variables.runNumber !== variables.resumedRunNumber + 1
        || variables.nextMessagePosition !== variables.notePosition + 1
      ) {
        refuse('A run resumes the run right before it, from the newest message')
      }

      if (
        memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
        !== variables.membershipCreatedAt
      ) {
        refuse('The membership changed since the resume read it')
      }

      const conversation = conversations.get(id(variables.conversationId))
      const resumed = runs.get(id(variables.resumedRunId))

      if (
        !resumed
        || !conversation
        || resumed.conversationId !== conversation.id
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || resumed.number !== variables.resumedRunNumber
        || resumed.anchorPosition !== variables.anchorPosition
        || !['STOPPED', 'INTERRUPTED'].includes(resumed.status)
      ) {
        refuse('Only a stopped or interrupted run resumes')
      }

      if (runsInFlight(variables.userId, variables.organizationId).length >= MAX_ACTIVE_RUNS_PER_MEMBER) {
        refuse('Somebody has at most 3 runs in flight in an organization')
      }

      if (
        conversation.deletedAt !== null
        || conversation.activeRunId !== null
        || conversation.nextRunNumber !== variables.runNumber
        || conversation.nextMessagePosition !== variables.nextMessagePosition
      ) {
        refuse('The conversation could not resume that run')
      }

      const note = messages.get(id(variables.noteId))

      if (
        !note
        || note.conversationId !== conversation.id
        || note.runId !== resumed.id
        || note.kind !== 'NOTE'
        || note.position !== variables.notePosition
      ) {
        refuse("The run's note is not the newest message")
      }

      const runId = id(variables.runId)

      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      messages.delete(note.id)
      Object.assign(conversation, {
        activeRunId: runId,
        preview: variables.preview ?? null,
        previewMessageId: variables.previewMessageId ? id(variables.previewMessageId) : null,
        nextRunNumber: conversation.nextRunNumber + 1,
        messageCount: conversation.messageCount - 1,
        updatedAt: now(),
      })
      runs.set(runId, {
        id: runId,
        conversationId: conversation.id,
        number: variables.runNumber,
        trigger: 'RESUME',
        status: 'QUEUED',
        membershipCreatedAt: variables.membershipCreatedAt,
        step: null,
        anchorPosition: variables.anchorPosition,
        stopRequestedAt: null,
        leaseExpiresAt: inSeconds(20 * 60),
        attempts: 0,
        createdAt: now(),
        startedAt: null,
        endedAt: null,
        pendingToolResults: variables.pendingToolResults ?? null,
      })

      return { conversation_updateMany: 1, conversationMessage_deleteMany: 1 }
    },

    RetryConversationRun: variables => {
      if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) {
        refuse('Only a member of an organization can keep conversations in it')
      }

      if (variables.runNumber !== variables.retriedRunNumber + 1) refuse('A run retries the run right before it')

      if (
        memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
        !== variables.membershipCreatedAt
      ) {
        refuse('The membership changed since the retry read it')
      }

      const conversation = conversations.get(id(variables.conversationId))
      const retried = runs.get(id(variables.retriedRunId))

      if (
        !retried
        || !conversation
        || retried.conversationId !== conversation.id
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || retried.number !== variables.retriedRunNumber
        || retried.anchorPosition !== variables.anchorPosition
        || !['STOPPED', 'FAILED', 'REFUSED', 'INTERRUPTED'].includes(retried.status)
      ) {
        refuse('Only a run that ended with a note is retried')
      }

      if (runsInFlight(variables.userId, variables.organizationId).length >= MAX_ACTIVE_RUNS_PER_MEMBER) {
        refuse('Somebody has at most 3 runs in flight in an organization')
      }

      if (
        conversation.deletedAt !== null
        || conversation.activeRunId !== null
        || conversation.nextRunNumber !== variables.runNumber
        || (conversation.historyRevision ?? 0) !== variables.historyRevision
      ) {
        refuse('The conversation could not retry that run')
      }

      const drawn = drawnOnAnchor(conversation.id, variables.anchorPosition)

      if (drawn.length !== variables.deletedCount) refuse("The runs' messages changed since the retry read them")

      const runId = id(variables.runId)

      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      for (const message of drawn) messages.delete(message.id)

      for (const entry of conversationEntries(conversation.id)) {
        if (entry.position > variables.anchorPosition) entries.delete(entry.id)
      }

      Object.assign(conversation, {
        activeRunId: runId,
        preview: variables.preview ?? null,
        previewMessageId: variables.previewMessageId ? id(variables.previewMessageId) : null,
        unreadCount: 0,
        isFull: false,
        nextRunNumber: conversation.nextRunNumber + 1,
        historyRevision: (conversation.historyRevision ?? 0) + 1,
        messageCount: conversation.messageCount - variables.deletedCount,
        updatedAt: now(),
      })
      runs.set(runId, {
        id: runId,
        conversationId: conversation.id,
        number: variables.runNumber,
        trigger: 'RETRY',
        status: 'QUEUED',
        membershipCreatedAt: variables.membershipCreatedAt,
        step: null,
        anchorPosition: variables.anchorPosition,
        stopRequestedAt: null,
        leaseExpiresAt: inSeconds(20 * 60),
        attempts: 0,
        createdAt: now(),
        startedAt: null,
        endedAt: null,
      })

      return { conversation_updateMany: 1 }
    },

    ClaimQueuedConversationRun: variables => {
      const run = findFencedRun(variables, 'QUEUED')

      if (!run) return { conversationRun_updateMany: 0 }

      Object.assign(run, {
        status: 'RUNNING',
        attempts: run.attempts + 1,
        leaseExpiresAt: inSeconds(60),
        startedAt: now(),
      })

      return { conversationRun_updateMany: 1 }
    },

    ReclaimConversationRun: variables => {
      const run = findFencedRun(variables)

      if (!run || !isPast(run.leaseExpiresAt)) return { conversationRun_updateMany: 0 }

      Object.assign(run, { attempts: run.attempts + 1, leaseExpiresAt: inSeconds(60) })

      return { conversationRun_updateMany: 1 }
    },

    RenewConversationRunLease: variables => {
      const run = findFencedRun(variables)

      if (!run) return { conversationRun_updateMany: 0 }

      run.leaseExpiresAt = inSeconds(60)
      assignGiven(run, { step: variables.step, context: variables.context, usage: variables.usage })

      return { conversationRun_updateMany: 1 }
    },

    StoreConversationTurn: variables => {
      const run = requireFencedRun(variables)

      insertEntry({
        id: id(variables.entryId),
        conversationId: run.conversationId,
        runId: run.id,
        position: variables.position,
        role: 'ASSISTANT',
        content: variables.content,
        drawnBlocks: 0,
      })
      run.leaseExpiresAt = inSeconds(60)
      assignGiven(run, { usage: variables.usage })

      return { conversationTranscriptEntry_insert: { id: id(variables.entryId) } }
    },

    StoreConversationTurnWithContext: variables => {
      const run = requireFencedRun(variables)

      if (variables.position !== variables.contextPosition + 1) refuse('The reply follows its context')

      const system: FakeEntry = {
        id: id(variables.contextEntryId),
        conversationId: run.conversationId,
        runId: run.id,
        position: variables.contextPosition,
        role: 'SYSTEM',
        content: variables.contextContent,
        contextHash: variables.contextHash,
        drawnBlocks: 0,
      }
      const assistant: FakeEntry = {
        id: id(variables.entryId),
        conversationId: run.conversationId,
        runId: run.id,
        position: variables.position,
        role: 'ASSISTANT',
        content: variables.content,
        drawnBlocks: 0,
      }

      checkEntry(system)
      checkEntry(assistant)
      insertEntry(system)
      insertEntry(assistant)
      run.leaseExpiresAt = inSeconds(60)
      assignGiven(run, { usage: variables.usage })

      return { system: { id: system.id }, assistant: { id: assistant.id } }
    },

    DrawConversationAgentText: variables => {
      const run = requireFencedRun(variables)
      const isFirstPiece = variables.toPiece === 1 && variables.toBlock >= variables.fromBlock
      const isWhole = variables.toBlock > variables.fromBlock && (variables.toPiece ?? 0) === 0

      if (variables.text.length > 20000 || (!isFirstPiece && !isWhole)) {
        refuse(
          'A message is drawn from one block or more, or is the first piece of a longer text, and holds at most 20000 characters',
        )
      }

      const conversation = requireDrawConversation(variables)
      const entry = entries.get(id(variables.entryId))

      if (
        !entry
        || entry.conversationId !== run.conversationId
        || entry.drawnBlocks !== variables.fromBlock
        || (entry.drawnPieces ?? 0) !== 0
      ) {
        refuse('Those blocks were drawn already')
      }

      insertMessage({
        id: id(variables.messageId),
        conversationId: conversation.id,
        runId: run.id,
        kind: 'AGENT_TEXT',
        text: variables.text,
        noteKind: null,
        toolStatus: null,
        position: variables.position,
        citations: variables.citations ?? null,
      })
      run.leaseExpiresAt = inSeconds(60)
      entry.drawnBlocks = variables.toBlock
      assignGiven(entry, { drawnPieces: variables.toPiece })
      Object.assign(conversation, {
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
        unreadCount: conversation.unreadCount + 1,
        updatedAt: now(),
      })

      return { conversationMessage_insert: { id: id(variables.messageId) } }
    },

    DrawConversationAgentTextPiece: variables => {
      const run = requireFencedRun(variables)
      const isNextPiece = variables.toBlock === variables.block && variables.toPiece === variables.fromPiece + 1
      const isLastPiece = variables.toBlock > variables.block && variables.toPiece === 0

      if (variables.text.length > 20000 || variables.fromPiece < 1 || (!isNextPiece && !isLastPiece)) {
        refuse('A later piece moves the cursor to the next, or past its text, and holds at most 20000 characters')
      }

      const conversation = requireDrawConversation(variables)
      const entry = entries.get(id(variables.entryId))

      if (
        !entry
        || entry.conversationId !== run.conversationId
        || entry.drawnBlocks !== variables.block
        || (entry.drawnPieces ?? 0) !== variables.fromPiece
      ) {
        refuse('That piece was drawn already')
      }

      insertMessage({
        id: id(variables.messageId),
        conversationId: conversation.id,
        runId: run.id,
        kind: 'AGENT_TEXT',
        text: variables.text,
        noteKind: null,
        toolStatus: null,
        position: variables.position,
        citations: variables.citations ?? null,
      })
      run.leaseExpiresAt = inSeconds(60)
      Object.assign(entry, { drawnBlocks: variables.toBlock, drawnPieces: variables.toPiece })
      Object.assign(conversation, {
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
        updatedAt: now(),
      })

      return { conversationMessage_insert: { id: id(variables.messageId) } }
    },

    DrawConversationToolCall: variables => {
      const run = requireFencedRun(variables)

      if (!(variables.toBlock > variables.fromBlock) || !['SUCCEEDED', 'FAILED'].includes(variables.toolStatus)) {
        refuse('A call is drawn from one block or more, finished')
      }

      const conversation = requireDrawConversation(variables)
      const entry = entries.get(id(variables.entryId))

      if (
        !entry
        || entry.conversationId !== run.conversationId
        || entry.drawnBlocks !== variables.fromBlock
        || (entry.drawnPieces ?? 0) !== 0
      ) {
        refuse('Those blocks were drawn already')
      }

      insertMessage({
        id: id(variables.messageId),
        conversationId: conversation.id,
        runId: run.id,
        kind: 'TOOL_CALL',
        text: null,
        noteKind: null,
        toolStatus: variables.toolStatus,
        position: variables.position,
        toolUseId: variables.toolUseId,
        toolName: variables.toolName,
        toolInput: variables.toolInput,
        toolOutput: variables.toolOutput,
      })
      run.leaseExpiresAt = inSeconds(60)
      entry.drawnBlocks = variables.toBlock
      Object.assign(conversation, {
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
        updatedAt: now(),
      })

      return { conversationMessage_insert: { id: id(variables.messageId) } }
    },

    DrawConversationQuestion: variables => {
      const run = requireFencedRun(variables)
      const options = variables.questionOptions as string[]

      if (
        !(variables.toBlock > variables.fromBlock)
        || [...variables.questionPrompt].length > 1000
        || options.length < 2
        || options.length > 6
        || options.some(option => [...option].length > 200)
      ) {
        refuse(
          'A question is drawn from its call, with a prompt of at most 1000 characters and 2 to 6 options of at most 200',
        )
      }

      const conversation = requireDrawConversation(variables)
      const entry = requireDrawEntry(run, variables)

      insertMessage({
        id: id(variables.messageId),
        conversationId: conversation.id,
        runId: run.id,
        kind: 'QUESTION',
        text: null,
        noteKind: null,
        toolStatus: null,
        position: variables.position,
        toolUseId: variables.toolUseId,
        questionPrompt: variables.questionPrompt,
        questionOptions: options,
        isMultipleChoice: variables.isMultipleChoice,
        isAnswerSkipped: false,
        answeredAt: null,
      })
      run.leaseExpiresAt = inSeconds(60)
      entry.drawnBlocks = variables.toBlock
      Object.assign(conversation, {
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
        unreadCount: conversation.unreadCount + 1,
        updatedAt: now(),
      })

      return { conversationMessage_insert: { id: id(variables.messageId) } }
    },

    DrawConversationClientToolCall: variables => {
      const run = requireFencedRun(variables)

      if (!(variables.toBlock > variables.fromBlock)) refuse('A call is drawn from one block or more')

      const conversation = requireDrawConversation(variables)
      const entry = requireDrawEntry(run, variables)

      insertMessage({
        id: id(variables.messageId),
        conversationId: conversation.id,
        runId: run.id,
        kind: 'TOOL_CALL',
        text: null,
        noteKind: null,
        toolStatus: 'RUNNING',
        position: variables.position,
        toolUseId: variables.toolUseId,
        toolName: variables.toolName,
        toolInput: variables.toolInput,
        toolOutput: null,
        toolStartedAt: null,
      })
      run.leaseExpiresAt = inSeconds(60)
      entry.drawnBlocks = variables.toBlock
      Object.assign(conversation, {
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
        updatedAt: now(),
      })

      return { conversationMessage_insert: { id: id(variables.messageId) } }
    },

    StartConversationToolCall: variables => {
      const run = requireFencedRun(variables)
      const message = messages.get(id(variables.messageId))

      if (
        !message
        || message.conversationId !== run.conversationId
        || message.kind !== 'TOOL_CALL'
        || !['RUNNING', 'CANCELLED'].includes(message.toolStatus ?? '')
      ) {
        refuse('The call has finished already')
      }

      run.leaseExpiresAt = inSeconds(60)
      Object.assign(message, { toolStatus: 'RUNNING', toolStartedAt: now() })

      return { conversationMessage_updateMany: 1 }
    },

    FinishConversationToolCall: variables => {
      const run = requireFencedRun(variables)

      if (!['SUCCEEDED', 'FAILED'].includes(variables.toolStatus)) refuse('A call finishes succeeded or failed')

      const message = messages.get(id(variables.messageId))

      if (
        !message
        || message.conversationId !== run.conversationId
        || message.kind !== 'TOOL_CALL'
        || message.toolStatus !== 'RUNNING'
      ) {
        refuse('The call is no longer running')
      }

      Object.assign(run, { pendingToolResults: variables.pendingToolResults, leaseExpiresAt: inSeconds(60) })
      Object.assign(message, {
        toolStatus: variables.toolStatus,
        toolOutput: variables.toolOutput,
        toolDurationMs: variables.toolDurationMs,
      })

      const conversation = conversations.get(run.conversationId)

      if (conversation?.previewMessageId === message.id) conversation.preview = variables.preview

      return { conversationMessage_updateMany: 1 }
    },

    StoreConversationToolResults: variables => {
      const run = requireFencedRun(variables)

      insertEntry({
        id: id(variables.entryId),
        conversationId: run.conversationId,
        runId: run.id,
        position: variables.position,
        role: 'USER',
        content: variables.content,
        drawnBlocks: 0,
      })
      Object.assign(run, { pendingToolResults: null, leaseExpiresAt: inSeconds(60) })

      return { conversationTranscriptEntry_insert: { id: id(variables.entryId) } }
    },

    FinishConversationRunWaiting: variables => {
      const run = requireFencedRun(variables)

      end(run, 'WAITING')
      assignGiven(run, { usage: variables.usage })
      cancelRunningCalls(run.conversationId)

      const conversation = conversations.get(id(variables.conversationId))

      if (conversation?.activeRunId === run.id) {
        Object.assign(conversation, { activeRunId: null, isAwaitingAnswer: true, updatedAt: now() })
        assignGiven(conversation, { preview: variables.preview })
      }

      return { conversationRun_updateMany: 1 }
    },

    FinishConversationRun: variables => {
      const run = requireFencedRun(variables)

      if (variables.status !== 'COMPLETED' && variables.status !== 'STOPPED') {
        refuse('A run ends this way completed or stopped')
      }

      end(run, variables.status)
      assignGiven(run, { usage: variables.usage })
      cancelRunningCalls(run.conversationId)

      const conversation = conversations.get(id(variables.conversationId))

      if (conversation?.activeRunId === run.id) conversation.activeRunId = null

      return { conversationRun_updateMany: 1 }
    },

    FinishConversationRunWithNote: variables => {
      const run = requireFencedRun(variables)

      const notes: Record<string, string[]> = { FAILED: ['FAILED', 'FULL'], STOPPED: ['STOPPED'], REFUSED: ['REFUSED'] }

      if (!notes[variables.status]?.includes(variables.noteKind)) {
        refuse('A run ends with its own note: failed or full, stopped, or refused')
      }

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, variables.status)
      assignGiven(run, { usage: variables.usage, failure: variables.failure })
      writeNote(conversation, variables, variables.noteKind)
      assignGiven(conversation, { isFull: variables.isFull })

      return { conversationRun_updateMany: 1 }
    },

    ClaimDeletedConversations: () => {
      let claimed = 0

      for (const conversation of conversations.values()) {
        if (isPastUndo(conversation) && conversation.pruneClaimedAt === null) {
          conversation.pruneClaimedAt = now()
          claimed++
        }
      }

      return { conversation_updateMany: claimed }
    },

    GetClaimedConversations: () => ({
      conversations: [...conversations.values()]
        .filter(conversation => conversation.pruneClaimedAt !== null && isPastUndo(conversation))
        .slice(0, 20)
        .map(conversation => ({ id: conversation.id })),
    }),

    DeleteClaimedConversations: ({ ids }) => {
      let deleted = 0

      for (const conversationId of ids as string[]) {
        const conversation = conversations.get(id(conversationId))

        if (conversation && conversation.pruneClaimedAt !== null && isPastUndo(conversation)) {
          deleteConversation(conversation.id)
          deleted++
        }
      }

      return { conversation_deleteMany: deleted }
    },

    InterruptConversationRun: variables => {
      const run = runs.get(id(variables.runId))
      const conversation = run && conversations.get(run.conversationId)

      if (
        !run
        || !conversation
        || !RUN_IN_FLIGHT.includes(run.status)
        || run.attempts !== variables.attempts
        || conversation.id !== id(variables.conversationId)
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
      ) {
        refuse("The run is no longer this worker's")
      }

      const noteConversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'INTERRUPTED')
      assignGiven(run, { failure: variables.failure })
      writeNote(noteConversation, variables, 'INTERRUPTED')

      return { conversationRun_updateMany: 1 }
    },

    RecordConversationSearch: variables => {
      if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) {
        refuse('Only a member of an organization can search its conversations')
      }

      if (recentSearches(variables.userId, variables.organizationId).length >= MAX_CONVERSATION_SEARCHES) {
        refuse('Somebody searches their conversations at most 120 times in ten minutes in an organization')
      }

      const search = {
        id: crypto.randomUUID().replaceAll('-', ''),
        userId: variables.userId,
        organizationId: id(variables.organizationId),
        createdAt: stamp(),
      }

      searches.set(search.id, search)

      return { conversationSearch_insert: { id: search.id } }
    },

    GetConversationSearchQuota: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

      return {
        userOrganization: membership ? { role: membership.role } : null,
        conversationSearches: recentSearches(variables.userId, variables.organizationId)
          .slice(0, MAX_CONVERSATION_SEARCHES)
          .map(search => ({ createdAt: search.createdAt })),
      }
    },

    SearchConversationTitles: variables => ({
      conversations_search: searchedConversations(variables)
        .map(conversation => ({ conversation, score: scoreMatch(conversation.title, variables.query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || (a.conversation.id < b.conversation.id ? -1 : 1))
        .slice(0, MAX_CONVERSATIONS)
        .map(({ conversation }) => ({ id: conversation.id })),
    }),

    SearchConversationMessages: variables => {
      const conversationIds = new Set(searchedConversations(variables).map(conversation => conversation.id))

      return {
        conversationMessages_search: [...searchedMessages(conversationIds).values()]
          .flat()
          .map(message => ({ message, score: scoreMatch(message.text ?? '', variables.query) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || (a.message.id < b.message.id ? -1 : 1))
          .slice(variables.offset, variables.offset + 500)
          .map(({ message }) => ({ conversationId: message.conversationId })),
      }
    },

    GetConversationSearchCorpus: variables => ({
      conversations: searchedConversations(variables)
        .sort((a, b) => (a.updatedAt !== b.updatedAt ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.id < b.id ? -1 : 1))
        .slice(0, MAX_CONVERSATIONS)
        .map(conversation => ({ id: conversation.id, messageCount: conversation.messageCount })),
    }),

    SearchConversationsBySubstring: variables => {
      const patterns = Array.from({ length: 8 }, (_, index) => String(variables[`pattern${index}`]))
      const recentIds = new Set((variables.recentIds as string[]).map(id))
      const recentMessages = searchedMessages(recentIds)
      const matchesAll = (text: string) => patterns.every(pattern => matchesLike(text, pattern))

      return {
        conversations: searchedConversations(variables)
          .filter(
            conversation =>
              matchesAll(conversation.title)
              || (recentMessages.get(conversation.id) ?? []).some(message => matchesAll(message.text ?? '')),
          )
          .slice(0, MAX_CONVERSATIONS)
          .map(conversation => ({ id: conversation.id })),
      }
    },

    DeleteExpiredConversationSearches: () => {
      const before = Date.now() - 24 * 60 * 60 * 1000
      let deleted = 0

      for (const search of searches.values()) {
        if (Date.parse(search.createdAt) < before) {
          searches.delete(search.id)
          deleted++
        }
      }

      return { conversationSearch_deleteMany: deleted }
    },
  }

  // The generated SDK's names: `startConversation(dataConnect, variables)` for `StartConversation`
  const sdk: Record<string, unknown> = {
    ConversationMessageKind,
    ConversationNoteKind,
    ConversationRunStatus,
    ConversationRunTrigger,
    ConversationToolStatus,
    ConversationTranscriptRole,
  }

  for (const [name, operation] of Object.entries(operations)) {
    sdk[name.charAt(0).toLowerCase() + name.slice(1)] = async (_dataConnect: unknown, variables: Variables) => {
      calls.push(name)

      await fake.beforeOperation(name, variables)

      return { data: operation(variables) }
    }
  }

  // Empties every table, for the next test
  function reset() {
    for (const table of [users, memberships, conversations, runs, messages, entries, searches]) table.clear()

    calls.length = 0
    fake.beforeOperation = async () => {}
  }

  return Object.assign(fake, { sdk, addMember, removeMember, restore, markRead, reset })
}

export type ConversationDatabaseFake = ReturnType<typeof createConversationDatabaseFake>

export default createConversationDatabaseFake
