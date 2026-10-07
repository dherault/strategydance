import { MAX_ACTIVE_RUNS_PER_MEMBER, MAX_CONVERSATION_MESSAGES, MAX_CONVERSATIONS } from 'strategydance-core'

import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  The backend connector's conversation operations, over tables kept in memory, for the domain's
  tests, which mock `strategydance-database/backend` with it. Each operation mirrors the conditions
  of its namesake in the connector, in the same order, and throws the same messages, so a test reads
  as the behaviour it checks rather than as a script of answers. `check:conversation-runs` checks
  those conditions against the emulators, which is what keeps the two alike: change one with the
  other.

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
  // Its context message as JSON text, once built, and its usage ledger
  context?: string | null
  usage?: unknown
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

export type FakeOrganization = {
  name: string
  brief: string | null
  exploredAspects: string[]
}

type Variables = Record<string, unknown>

// What a test reads the variables of an operation as
type AnyVariables = Record<string, any>

const RUN_IN_FLIGHT = ['QUEUED', 'RUNNING']

function createConversationDatabaseFake() {
  const users = new Map<string, FakeUser>()
  const memberships = new Map<string, FakeMembership>()
  const organizations = new Map<string, FakeOrganization>()
  const conversations = new Map<string, FakeConversation>()
  const runs = new Map<string, FakeRun>()
  const messages = new Map<string, FakeMessage>()
  const entries = new Map<string, FakeEntry>()
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

  function conversationMessages(conversationId: string) {
    return [...messages.values()].filter(message => message.conversationId === conversationId)
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
    const run = runs.get(id(variables.runId))
    const conversation = run && conversations.get(run.conversationId)

    if (
      !run
      || !conversation
      || run.status !== 'QUEUED'
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

    for (const message of messages.values()) {
      if (message.runId === runId && message.kind === 'TOOL_CALL' && message.toolStatus === 'RUNNING') {
        message.toolStatus = 'CANCELLED'
      }
    }

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
        conversationTranscriptEntries: lastEntry ? [{ position: lastEntry.position, role: lastEntry.role }] : [],
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
          .sort((a, b) => a.position - b.position)
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
      const conversationId = id(variables.conversationId)
      const runId = id(variables.runId)
      const conversation = conversations.get(conversationId)

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

      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')
      if (conversationEntries(conversationId).some(({ position }) => position === variables.transcriptPosition)) {
        refuse('violates SQL unique constraint: conversation_transcript_entry_conversation_id_position_uidx')
      }

      Object.assign(conversation, {
        activeRunId: runId,
        preview: variables.preview,
        previewMessageId: id(variables.messageId),
        nextMessagePosition: conversation.nextMessagePosition + 1,
        nextRunNumber: conversation.nextRunNumber + 1,
        messageCount: conversation.messageCount + 1,
        updatedAt: now(),
      })
      runs.set(runId, {
        id: runId,
        conversationId,
        number: variables.runNumber,
        trigger: 'MESSAGE',
        status: 'QUEUED',
        membershipCreatedAt: variables.membershipCreatedAt,
        step: null,
        anchorPosition: variables.transcriptPosition,
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
        position: variables.position,
      })
      insertEntry({
        id: crypto.randomUUID().replaceAll('-', ''),
        conversationId,
        runId,
        position: variables.transcriptPosition,
        role: 'USER',
        content: variables.content,
        drawnBlocks: 0,
      })

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
      const isFirstPiece = variables.toPiece === 1 && variables.toBlock === variables.fromBlock
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
        || entry.runId !== run.id
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
        || entry.runId !== run.id
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
        || entry.runId !== run.id
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

    FinishConversationRun: variables => {
      const run = requireFencedRun(variables)

      if (variables.status !== 'COMPLETED' && variables.status !== 'STOPPED') {
        refuse('A run ends this way completed or stopped')
      }

      end(run, variables.status)
      assignGiven(run, { usage: variables.usage })

      const conversation = conversations.get(id(variables.conversationId))

      if (conversation?.activeRunId === run.id) conversation.activeRunId = null

      return { conversationRun_updateMany: 1 }
    },

    FinishConversationRunWithNote: variables => {
      const run = requireFencedRun(variables)

      if (!['FAILED', 'STOPPED', 'REFUSED'].includes(variables.status)) {
        refuse('A run ends with a note failed, stopped or refused')
      }

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, variables.status)
      assignGiven(run, { usage: variables.usage })
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
      writeNote(noteConversation, variables, 'INTERRUPTED')

      return { conversationRun_updateMany: 1 }
    },
  }

  // The generated SDK's names: `startConversation(dataConnect, variables)` for `StartConversation`
  const sdk: Record<string, unknown> = {
    ConversationMessageKind,
    ConversationNoteKind,
    ConversationRunStatus,
    ConversationRunTrigger,
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
    for (const table of [users, memberships, conversations, runs, messages, entries]) table.clear()

    calls.length = 0
    fake.beforeOperation = async () => {}
  }

  return Object.assign(fake, { sdk, addMember, removeMember, restore, reset })
}

export type ConversationDatabaseFake = ReturnType<typeof createConversationDatabaseFake>

export default createConversationDatabaseFake
