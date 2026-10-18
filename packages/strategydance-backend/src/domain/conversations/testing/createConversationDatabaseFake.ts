import {
  CONVERSATION_ATTACHMENT_CONTENT_TYPES,
  CONVERSATION_SEARCH_WINDOW_MINUTES,
  MAX_ACTIVE_RUNS_PER_MEMBER,
  MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER,
  MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH,
  MAX_CONVERSATION_ATTACHMENT_SIZE,
  MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_SEARCHES,
  MAX_CONVERSATIONS,
  MAX_CONVERSATION_SUBAGENTS,
  MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
  MAX_DAILY_CONVERSATIONS_PER_MEMBER,
  MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  MAX_DAILY_RUNS_PER_ACCOUNT,
  MAX_DAILY_RUNS_PER_MEMBER,
  MAX_DAILY_RUNS_PER_ORGANIZATION,
  MAX_DAILY_SUBAGENTS_PER_ACCOUNT,
  MAX_DAILY_SUBAGENTS_PER_MEMBER,
  MAX_PENDING_CONVERSATION_ATTACHMENTS,
  MAX_SUBAGENTS_PER_ACTION,
  DAILY_CAP_OVERRUN_FACTOR,
  DAILY_CAP_WINDOW_HOURS,
} from 'strategydance-core'

import toCanonicalUuid from '~utils/toCanonicalUuid'
import toSortableInstant from '~utils/toSortableInstant'

import createIntegrationDatabaseFake from '~domain/integrations/testing/createIntegrationDatabaseFake'
import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

/*
  The backend connector's conversation operations, over tables kept in memory, for the domain's
  tests, which mock `strategydance-database/backend` with it. Each operation mirrors the conditions
  of its namesake in the connector, in the same order, and throws the same messages, so a test reads
  as the behaviour it checks rather than as a script of answers. `check:conversation-runs` and
  `check:conversation-search` check those conditions against the emulators, which is what keeps the
  two alike: change one with the other. A search matches words and patterns as near as a test
  needs, which the second checks against Postgres' own.

  It holds the modules' fake too, as `modules`, its operations in the same SDK, since a run's worker
  loads every module's server, and Bun refuses an import the mock does not hold, and the
  integrations' fake, as `integrations`, since a run's agent lists and calls the organization's
  servers. A member is added to and removed from all three at once, with one `createdAt`, so a run
  and the modules and servers it calls agree on who its author is. Each keeps its own `calls` and
  `beforeOperation`

  An operation checks everything before it changes anything, so it applies whole or not at all, as
  a transaction does, and runs without yielding, so two called at once take turns as two locked
  transactions do. `beforeOperation` runs first, which is where a test lets something happen
  meanwhile, a member removed say, and `afterOperation` last, which is where it loses an answer. Times are the clock's, which a test moves with `setSystemTime`.
  Ids are kept as Data Connect keeps them, dashless
*/

export const ConversationAttachmentStatus = {
  UPLOADING: 'UPLOADING',
  READY: 'READY',
  PRUNING: 'PRUNING',
} as const

export const ConversationActor = {
  MEMBER: 'MEMBER',
  AGENT: 'AGENT',
} as const

export const ConversationMessageKind = {
  MEMBER_TEXT: 'MEMBER_TEXT',
  AGENT_TEXT: 'AGENT_TEXT',
  TOOL_CALL: 'TOOL_CALL',
  QUESTION: 'QUESTION',
  ASPECTS: 'ASPECTS',
  NOTE: 'NOTE',
  APPROVAL: 'APPROVAL',
  BRIEF: 'BRIEF',
} as const

export const ConversationApprovalState = {
  PENDING: 'PENDING',
  ALLOWED: 'ALLOWED',
  DENIED: 'DENIED',
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
  PENDING: 'PENDING',
  CHAINED: 'CHAINED',
} as const

export const ConversationRunTrigger = {
  MESSAGE: 'MESSAGE',
  ANSWER: 'ANSWER',
  RESUME: 'RESUME',
  RETRY: 'RETRY',
  LAUNCH: 'LAUNCH',
  CONTINUE: 'CONTINUE',
  REPORTS: 'REPORTS',
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
  // Which aspects of the company it is about, none unless a test says, and who set them, nobody
  // until somebody does
  aspects?: string[]
  aspectsSetBy?: string | null
  // How many times a retry cut its history, 0 until one does
  historyRevision?: number
  // Whether a question waits for the member, false until a run ends on one
  isAwaitingAnswer?: boolean
  // A subagent's: the conversation that launched it, the run and the call that did, the parent's
  // anchor it was launched on, and its report once written. Absent on every other conversation,
  // so a check reads them with `== null`
  parentId?: string | null
  launchRunId?: string | null
  launchToolUseId?: string | null
  launchAnchorPosition?: number | null
  report?: string | null
  reportedAt?: string | null
  // When its report reached its parent's transcript, or was marked so once its parent was full
  reportDeliveredAt?: string | null
  // A parent's: the subagents it launched and are not pruned, 0 until a launch
  subagentCount?: number
  // When it was made, which a subagent's launch stamps, as the module's list orders them
  createdAt?: string
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
  // An aspects note's aspects, and who set them
  aspects?: string[] | null
  aspectsSetBy?: string | null
  // A call to an integration's: its server and tool, an approval's state, what it is bound to, and
  // its arguments at a glance
  integrationId?: string | null
  integrationName?: string | null
  integrationToolName?: string | null
  approvalState?: string | null
  approvalConfigRevision?: number | null
  approvalToolHash?: string | null
  approvalCredentialGeneration?: string | null
  argumentsPreview?: string | null
  // A brief's: the files of its parent's it hands over
  attachmentIds?: string[] | null
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

// A start the daily caps count, kept past what it counts, its organization a plain id
export type FakeCappedStart = {
  id: string
  userId: string
  organizationId: string
  kind: CappedStartKind
  createdAt: string
}

type CappedStartKind = 'CONVERSATION' | 'RUN' | 'SUBAGENT'

type CapScope = 'member' | 'account' | 'organization'

// Each cap by what it counts and whose, as the mutations write them out: subagents have no
// organization's
const DAILY_CAPS: Record<CappedStartKind, Partial<Record<CapScope, number>>> = {
  CONVERSATION: {
    member: MAX_DAILY_CONVERSATIONS_PER_MEMBER,
    account: MAX_DAILY_CONVERSATIONS_PER_ACCOUNT,
    organization: MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION,
  },
  RUN: {
    member: MAX_DAILY_RUNS_PER_MEMBER,
    account: MAX_DAILY_RUNS_PER_ACCOUNT,
    organization: MAX_DAILY_RUNS_PER_ORGANIZATION,
  },
  SUBAGENT: { member: MAX_DAILY_SUBAGENTS_PER_MEMBER, account: MAX_DAILY_SUBAGENTS_PER_ACCOUNT },
}

const CAPPED_NOUNS: Record<CappedStartKind, string> = {
  CONVERSATION: 'conversations',
  RUN: 'runs',
  SUBAGENT: 'subagents',
}

// A file a member sent or uploaded to send, with where it stands and what its upload counted
export type FakeAttachment = {
  id: string
  userId: string
  organizationId: string
  conversationId: string
  messageId: string | null
  status: string
  name: string
  contentType: string
  size: number
  pageCount: number | null
  tokenCount: number | null
  claudeFileId: string | null
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
  const attachments = new Map<string, FakeAttachment>()
  const cappedStarts = new Map<string, FakeCappedStart>()
  // Every operation called, by name, in order
  const calls: string[] = []
  const modules = createModuleDatabaseFake()
  const integrations = createIntegrationDatabaseFake()
  let stamps = 0

  const fake = {
    modules,
    integrations,
    users,
    memberships,
    organizations,
    conversations,
    runs,
    messages,
    entries,
    searches,
    attachments,
    cappedStarts,
    calls,
    beforeOperation: async (_name: string, _variables: AnyVariables): Promise<void> => {},
    // Runs once an operation applied, where a test throws to lose a write's answer after it landed
    afterOperation: async (_name: string, _variables: AnyVariables): Promise<void> => {},
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
    modules.addMember(userId, organizationId, { createdAt })
    integrations.addMember(userId, organizationId, 'MEMBER', createdAt)

    return createdAt
  }

  function removeMember(userId: string, organizationId: string) {
    memberships.delete(membershipKey(userId, organizationId))
    modules.removeMember(userId, organizationId)
    integrations.removeMember(userId, organizationId)
  }

  // Whether a conversation was deleted over a day ago, past its Undo
  function isPastUndo(conversation: FakeConversation) {
    return conversation.deletedAt !== null && Date.parse(conversation.deletedAt) < Date.now() - 24 * 60 * 60 * 1000
  }

  // Deletes a conversation with what cascades from it: its runs, messages and transcript
  function deleteConversation(conversationId: string) {
    conversations.delete(conversationId)

    // A subagent's parent is an optional reference, set to null on delete
    for (const conversation of conversations.values()) {
      if (conversation.parentId === conversationId) conversation.parentId = null
    }

    // A file's message is an optional reference, set to null on delete
    for (const attachment of attachments.values()) {
      if (attachment.messageId && messages.get(attachment.messageId)?.conversationId === conversationId) {
        attachment.messageId = null
      }
    }

    for (const table of [runs, messages, entries]) {
      for (const row of table.values()) {
        if (row.conversationId === conversationId) table.delete(row.id)
      }
    }
  }

  /*
    Asks a parent's subagents' runs to stop, queued, running or waiting for a slot and not asked yet,
    those launched on an anchor or named when either is given, and answers how many, as the cascades'
    operations ask them after the parent's row
  */
  function askSubagentRunsToStop(
    parentId: string,
    {
      anchorPosition,
      subagentIds,
      isLiveOnly = false,
    }: { anchorPosition?: number; subagentIds?: string[]; isLiveOnly?: boolean },
  ) {
    let asked = 0

    for (const run of runs.values()) {
      const subagent = conversations.get(run.conversationId)

      if (
        subagent?.parentId === parentId
        && ['QUEUED', 'RUNNING', 'PENDING'].includes(run.status)
        && run.stopRequestedAt === null
        && (anchorPosition === undefined || subagent.launchAnchorPosition === anchorPosition)
        && (subagentIds === undefined || subagentIds.map(id).includes(subagent.id))
        && (!isLiveOnly || subagent.deletedAt === null)
      ) {
        run.stopRequestedAt = now()
        asked++
      }
    }

    return asked
  }

  /*
    The web connector's `DeleteConversation`: the caller's conversation deleted, its runs asked to
    stop, and its live subagents deleted at its own instant, their runs asked to stop. A subagent's id
    changes nothing
  */
  function deleteAsMember(conversationId: string, userId: string, organizationId: string) {
    const conversation = conversations.get(id(conversationId))

    if (
      !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== id(organizationId)
      || conversation.deletedAt !== null
      || conversation.parentId != null
    ) {
      return
    }

    // Postgres stamps it to the microsecond, which no other delete shares
    const deletedAt = stamp()

    for (const run of runs.values()) {
      if (
        run.conversationId === conversation.id
        && RUN_IN_FLIGHT.includes(run.status)
        && run.stopRequestedAt === null
      ) {
        run.stopRequestedAt = deletedAt
      }
    }

    conversation.deletedAt = deletedAt
    askSubagentRunsToStop(conversation.id, { isLiveOnly: true })

    for (const subagent of conversations.values()) {
      if (subagent.parentId === conversation.id && subagent.deletedAt === null) subagent.deletedAt = deletedAt
    }
  }

  /*
    The web connector's `RestoreConversation`, as far as a sweep meets it: a deleted conversation of
    the caller's comes back only within a day of its delete and while no sweep has claimed it, and is
    refused as the connector refuses it otherwise. The membership's lock and the count of 1000 are
    left to its own checks
  */
  function restore(conversationId: string, userId: string, organizationId: string) {
    const conversation = conversations.get(id(conversationId))

    if (
      !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== id(organizationId)
      || conversation.deletedAt === null
      || isPastUndo(conversation)
      || conversation.pruneClaimedAt !== null
      || conversation.parentId != null
    ) {
      refuse('The conversation is gone for good')
    }

    const { deletedAt } = conversation

    conversation.deletedAt = null

    // Its subagents its delete took, at its own instant, and none a retry deleted at another
    for (const subagent of conversations.values()) {
      if (
        subagent.parentId === conversation.id
        && subagent.pruneClaimedAt === null
        && subagent.deletedAt === deletedAt
      ) {
        subagent.deletedAt = null
      }
    }
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
      && conversation.parentId == null
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
        && conversation.parentId == null
      )
    })
  }

  // A member's subagent runs in an organization in one of those statuses, whatever conversation
  // launched them, oldest first, as the slots and the promotion read them. Two of one millisecond
  // keep the order they were made in, where Postgres' microseconds would tell them apart
  function subagentRuns(userId: unknown, organizationId: unknown, statuses: string[]) {
    return [...runs.values()]
      .filter(run => {
        const conversation = conversations.get(run.conversationId)

        return (
          statuses.includes(run.status)
          && conversation !== undefined
          && conversation.userId === userId
          && conversation.organizationId === id(organizationId)
          && conversation.parentId != null
        )
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  }

  // The subagent runs no page may reconcile, past their lease or waiting for a slot, with their
  // subagent, as the sweep's reads find their members
  function sweptRuns() {
    return [...runs.values()].flatMap(run => {
      const conversation = conversations.get(run.conversationId)
      const isDue = run.status === 'PENDING' || (RUN_IN_FLIGHT.includes(run.status) && isPast(run.leaseExpiresAt))

      return conversation?.parentId != null && isDue ? [{ run, conversation }] : []
    })
  }

  // The conversations, live and idle, waiting on no answer, in which a report of a live subagent
  // waits, the longest idle first, as the reaction's reads find them
  function reactingConversations() {
    return [...conversations.values()]
      .filter(
        conversation =>
          conversation.parentId == null
          && conversation.deletedAt === null
          && conversation.activeRunId === null
          && !conversation.isAwaitingAnswer
          && waitingReports(conversation.id).length > 0,
      )
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
  }

  // The caller's conversations in the organization, deleted ones and subagents aside
  function keptConversations(variables: AnyVariables) {
    return [...conversations.values()].filter(
      conversation =>
        conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
        && conversation.deletedAt === null
        && conversation.parentId == null,
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

  // The starts of one kind the daily caps counted in the last 24 hours, newest first: the member's in
  // the organization, the account's across every organization, or the organization's
  function todaysStarts(variables: AnyVariables, kind: CappedStartKind, scope: CapScope) {
    const since = Date.now() - DAILY_CAP_WINDOW_HOURS * 60 * 60 * 1000

    return [...cappedStarts.values()]
      .filter(
        start =>
          start.kind === kind
          && Date.parse(start.createdAt) > since
          && (scope === 'organization' || start.userId === variables.userId)
          && (scope === 'account' || start.organizationId === id(variables.organizationId)),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }

  /*
    The daily caps a mutation counts in its query step, in its order and with its messages: the
    member's, the account's and the organization's, each refused at its cap, or at one and a half
    times it for what finishes work under way. Lifted when `isUsageCapped` is false, and held when it
    is left out
  */
  function checkDailyCaps(variables: AnyVariables, kind: CappedStartKind, { isFinishing = false } = {}) {
    if (variables.isUsageCapped === false) return

    const verb = kind === 'SUBAGENT' ? 'launches' : 'starts'
    const finishing = isFinishing ? ', finishing work under way' : ''

    for (const [scope, cap] of Object.entries(DAILY_CAPS[kind]) as [CapScope, number][]) {
      const limit = isFinishing ? cap * DAILY_CAP_OVERRUN_FACTOR : cap

      if (todaysStarts(variables, kind, scope).length < limit) continue

      const noun = CAPPED_NOUNS[kind]

      refuse(
        scope === 'member'
          ? `Somebody ${verb} at most ${limit} ${noun} in 24 hours in an organization${finishing}`
          : scope === 'account'
            ? `An account ${verb} at most ${limit} ${noun} in 24 hours across its organizations${finishing}`
            : `An organization ${verb} at most ${limit} ${noun} in 24 hours${finishing}`,
      )
    }
  }

  // The row a mutation inserts last for what it started
  function recordStart(variables: AnyVariables, kind: CappedStartKind) {
    const start = {
      id: crypto.randomUUID().replaceAll('-', ''),
      userId: String(variables.userId),
      organizationId: id(variables.organizationId),
      kind,
      createdAt: stamp(),
    }

    cappedStarts.set(start.id, start)
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

  // The questions of a conversation still waiting for an answer, and its calls waiting for the
  // member's approval, which only the turn its transcript ends on can hold
  function waitingQuestions(conversationId: string) {
    return conversationMessages(conversationId).filter(
      message => ['QUESTION', 'APPROVAL'].includes(message.kind) && (message.answeredAt ?? null) === null,
    )
  }

  // The calls of a conversation the member allowed that have not started
  function allowedCalls(conversationId: string) {
    return conversationMessages(conversationId).filter(
      message => message.kind === 'APPROVAL' && message.approvalState === 'ALLOWED' && !message.toolStatus,
    )
  }

  /*
    Applies a write to the rows a list variable names, which a write of the send's does for the calls
    waiting for approval: exactly those named, and none when the list is left out, whose filter Data
    Connect then drops, so any row matching refuses the call
  */
  function updateNamed(
    rows: FakeMessage[],
    ids: string[] | null | undefined,
    message: string,
    change: (row: FakeMessage) => void,
  ) {
    const named = ids ? rows.filter(row => ids.map(id).includes(row.id)) : rows

    if (named.length !== (ids?.length ?? 0)) refuse(message)

    return () => named.forEach(change)
  }

  // A parent's live subagents whose report waits to be delivered, oldest first
  function waitingReports(parentId: string) {
    return [...conversations.values()]
      .filter(
        conversation =>
          conversation.parentId === parentId
          && conversation.deletedAt === null
          && conversation.reportedAt != null
          && conversation.reportDeliveredAt == null,
      )
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
  }

  // The reports waiting of a conversation of the caller's, as the send's and the turn's contexts read them
  function readWaitingReports(variables: AnyVariables) {
    const conversation = conversations.get(id(variables.conversationId))

    if (
      !conversation
      || conversation.userId !== variables.userId
      || conversation.organizationId !== id(variables.organizationId)
    ) {
      return []
    }

    return waitingReports(conversation.id)
      .slice(0, 100)
      .map(subagent => ({
        id: subagent.id,
        title: subagent.title,
        report: subagent.report ?? null,
        latestRuns: latestRuns(subagent.id)
          .slice(0, 1)
          .map(({ status }) => ({ status })),
      }))
  }

  /*
    Marks delivered exactly the reports a write names among a parent's waiting, refused when they
    changed since they were read, as the operations count them. A write from before M33 names none,
    which drops the filter: it is refused while any report waits
  */
  function deliverNamed(parentId: string, ids: string[] | null | undefined) {
    const rows = waitingReports(parentId)
    const named = ids ? rows.filter(row => ids.map(id).includes(row.id)) : rows

    if (named.length !== (ids?.length ?? 0)) refuse('The reports changed since the backend read them')

    return () => named.forEach(row => (row.reportDeliveredAt = now()))
  }

  // The server and tool a call to an integration was drawn with, none for any other call
  function integrationFields(variables: AnyVariables) {
    return {
      integrationId: variables.integrationId ? id(variables.integrationId) : null,
      integrationName: variables.integrationName ?? null,
      integrationToolName: variables.integrationToolName ?? null,
    }
  }

  // A conversation's runs, latest first
  function latestRuns(conversationId: string) {
    return [...runs.values()].filter(run => run.conversationId === conversationId).sort((a, b) => b.number - a.number)
  }

  // Cancels the calls still running in a conversation, which only its run in flight can have, an
  // integration's an approval allowed included
  function cancelRunningCalls(conversationId: string) {
    for (const message of conversationMessages(conversationId)) {
      if (['TOOL_CALL', 'APPROVAL'].includes(message.kind) && message.toolStatus === 'RUNNING') {
        message.toolStatus = 'CANCELLED'
      }
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

  // The fence of a subagent's own draws and endings, which a conversation's run never passes
  function requireSubagentRun(variables: AnyVariables) {
    const run = requireFencedRun(variables)

    if (conversations.get(run.conversationId)?.parentId == null) refuse("The run is no longer this worker's")

    return run
  }

  // The report a subagent's ending writes, at most 8000 characters, checked before anything changes
  function checkReport(variables: AnyVariables) {
    if ([...String(variables.report)].length > 8000) refuse("A subagent's report holds at most 8000 characters")
  }

  function writeReport(conversation: FakeConversation, variables: AnyVariables) {
    Object.assign(conversation, { report: variables.report, reportedAt: now() })
  }

  // The fence of a conversation's own endings, which a subagent's run never passes: its endings
  // write its report
  function requireParentRun(variables: AnyVariables) {
    const run = requireFencedRun(variables)

    if (conversations.get(run.conversationId)?.parentId != null) refuse("The run is no longer this worker's")

    return run
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

  /*
    The connector's `LaunchSubagent`, its first run queued into one of the member's five slots, and
    `LaunchPendingSubagent`, its first run pending, with no lease, whatever the slots
  */
  // The live subagents a parent launched, the member's, newest first and then by id, as the
  // Subagents module reads them
  function liveSubagents(variables: AnyVariables) {
    return [...conversations.values()]
      .filter(
        conversation =>
          conversation.parentId === id(variables.parentId)
          && conversation.userId === variables.userId
          && conversation.organizationId === id(variables.organizationId)
          && conversation.deletedAt === null,
      )
      .sort((a, b) => {
        // In time, as Postgres orders them, however many digits each fraction was written with
        const [first, second] = [toSortableInstant(a.createdAt ?? ''), toSortableInstant(b.createdAt ?? '')]

        return first > second ? -1 : first < second ? 1 : a.id < b.id ? -1 : 1
      })
  }

  // The membership the module read, as its operations answer it beside their rows
  function moduleMembership(variables: AnyVariables) {
    return memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
      === variables.membershipCreatedAt
      ? [{ userId: variables.userId }]
      : []
  }

  // `LaunchSubagent` and `LaunchPendingSubagent`, and the Subagents module's, which store their
  // call's key after the membership's lock and check the run launching them after the parent's row
  function launchSubagent(
    variables: AnyVariables,
    { isPending, isForAgent = false }: { isPending: boolean; isForAgent?: boolean },
  ) {
    if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) {
      refuse('Only a member of an organization can launch subagents in it')
    }

    const attachmentIds = (variables.attachmentIds as string[]).map(id)

    if ([...variables.title].length > 120 || [...variables.text].length > 20000 || attachmentIds.length > 10) {
      refuse("A subagent's title holds at most 120 characters, its brief 20000, and its files 10")
    }

    if (isForAgent) {
      modules.checkKey(variables)
      modules.insertResult(variables)
    }

    const parentId = id(variables.parentId)
    const parent = conversations.get(parentId)

    if (
      !parent
      || parent.userId !== variables.userId
      || parent.organizationId !== id(variables.organizationId)
      || parent.deletedAt !== null
      || parent.parentId != null
      || (parent.subagentCount ?? 0) >= MAX_CONVERSATION_SUBAGENTS
    ) {
      refuse('The parent launches no more subagents: it is gone, a subagent, or holds 100')
    }

    if (
      memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
      !== variables.membershipCreatedAt
    ) {
      refuse('The membership changed since the launch read it')
    }

    if (isForAgent) {
      const launcher = runs.get(id(variables.launchRunId))
      const launching = launcher && conversations.get(launcher.conversationId)

      if (
        !launcher
        || !launching
        || launcher.status !== 'RUNNING'
        || launcher.stopRequestedAt !== null
        || launcher.anchorPosition !== variables.anchorPosition
        || launcher.trigger === 'REPORTS'
        || launching.id !== parentId
        || launching.userId !== variables.userId
        || launching.organizationId !== id(variables.organizationId)
      ) {
        refuse('The run launching the subagent has ended or was asked to stop')
      }
    }

    const subagentId = id(variables.conversationId)

    if (conversations.has(subagentId)) refuse('The subagent exists already')

    const onAnchor = [...conversations.values()].filter(
      conversation =>
        conversation.parentId === parentId
        && conversation.launchAnchorPosition === variables.anchorPosition
        && conversation.deletedAt === null,
    )

    if (onAnchor.length >= MAX_SUBAGENTS_PER_ACTION) refuse('A parent launches at most 10 subagents on one anchor')

    const files = [...attachments.values()].filter(
      attachment =>
        attachmentIds.includes(attachment.id)
        && isAttachmentOf(attachment, { ...variables, conversationId: parentId })
        && attachment.status === 'READY'
        && attachment.messageId !== null,
    )

    if (files.length !== attachmentIds.length) refuse('A subagent is handed only files its parent sent')

    if (
      !isPending
      && subagentRuns(variables.userId, variables.organizationId, RUN_IN_FLIGHT).length
        >= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER
    ) {
      refuse("Every one of the member's 5 subagent slots is taken")
    }

    checkDailyCaps(variables, 'SUBAGENT')

    const runId = id(variables.runId)

    if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')
    if (messages.has(id(variables.messageId))) refuse('violates SQL unique constraint: conversation_message_pkey')

    parent.subagentCount = (parent.subagentCount ?? 0) + 1
    conversations.set(subagentId, {
      id: subagentId,
      userId: variables.userId,
      organizationId: id(variables.organizationId),
      title: variables.title,
      activeRunId: runId,
      preview: null,
      previewMessageId: null,
      unreadCount: 0,
      nextRunNumber: 1,
      nextMessagePosition: 1,
      messageCount: 1,
      isFull: false,
      deletedAt: null,
      pruneClaimedAt: null,
      updatedAt: now(),
      aspects: [],
      aspectsSetBy: null,
      parentId,
      launchRunId: variables.launchRunId ? id(variables.launchRunId) : null,
      launchToolUseId: variables.launchToolUseId ?? null,
      launchAnchorPosition: variables.anchorPosition,
      report: null,
      reportedAt: null,
      subagentCount: 0,
      createdAt: stamp(),
    })
    const run = queuedRun(runId, subagentId, { ...variables, runNumber: 0 }, 'LAUNCH', 0)

    // A run launched past the slots waits pending, with no lease
    runs.set(runId, isPending ? { ...run, status: 'PENDING', leaseExpiresAt: null } : run)
    insertMessage({
      id: id(variables.messageId),
      conversationId: subagentId,
      runId,
      kind: 'BRIEF',
      text: variables.text,
      noteKind: null,
      toolStatus: null,
      position: 0,
      attachmentIds,
    })
    insertEntry({
      id: crypto.randomUUID().replaceAll('-', ''),
      conversationId: subagentId,
      runId,
      position: 0,
      role: 'USER',
      content: variables.content,
      drawnBlocks: 0,
    })

    if (isForAgent) modules.storeResult(variables)

    recordStart(variables, 'SUBAGENT')

    return { conversation_updateMany: 1 }
  }

  // A subagent's run still waiting for a slot, in the caller's conversation, as the pending endings
  // find theirs, refused with their message
  function requirePendingRun(variables: AnyVariables, message: string) {
    const run = findOwnedRun(variables, 'PENDING')

    if (!run || conversations.get(run.conversationId)?.parentId == null) refuse(message)

    return run
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
    checkDailyCaps(variables, 'RUN')

    if (
      !conversation
      || conversation.userId !== variables.userId
      || conversation.organizationId !== id(variables.organizationId)
      || conversation.deletedAt !== null
      || conversation.parentId != null
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

  // Whether a file belongs to a conversation's author in its organization, as every lookup matches it
  function isAttachmentOf(attachment: FakeAttachment, variables: AnyVariables) {
    return (
      attachment.userId === variables.userId
      && attachment.organizationId === id(variables.organizationId)
      && attachment.conversationId === id(variables.conversationId)
    )
  }

  // A member's files uploaded and not sent, younger than two days, which their quota counts
  function pendingAttachments(userId: unknown, organizationId: unknown) {
    const since = Date.now() - 2 * 24 * 60 * 60 * 1000

    return [...attachments.values()].filter(
      attachment =>
        attachment.userId === userId
        && attachment.organizationId === id(organizationId)
        && attachment.messageId === null
        && Date.parse(attachment.createdAt) > since,
    )
  }

  // An unsent file a prune may claim: a reservation ten minutes old, or a file two days old
  function isExpiredAttachment(attachment: FakeAttachment) {
    const age = Date.now() - Date.parse(attachment.createdAt)

    return (
      attachment.messageId === null
      && ((attachment.status === 'UPLOADING' && age > 10 * 60 * 1000)
        || (attachment.status === 'READY' && age > 2 * 24 * 60 * 60 * 1000))
    )
  }

  // The first step's bound on the files a send names, at most 10
  function checkAttachmentCount(variables: AnyVariables) {
    if ((variables.attachmentIds?.length ?? 0) > MAX_CONVERSATION_ATTACHMENTS_PER_MESSAGE) {
      refuse('A message sends at most 10 files')
    }
  }

  // The files a send sets to its message, checked before it writes: exactly those it names, the
  // caller's in the conversation, stored and unsent, counted as the connector counts rows against
  // the list it was given
  function matchSentAttachments(variables: AnyVariables) {
    const ids: string[] = (variables.attachmentIds ?? []).map(id)
    const matched = [...attachments.values()].filter(
      attachment =>
        ids.includes(attachment.id)
        && isAttachmentOf(attachment, variables)
        && attachment.status === 'READY'
        && attachment.messageId === null,
    )

    if (matched.length !== ids.length) refuse("The message's files changed since the send read them")

    return matched
  }

  // A message's files in the order it sends them, by their names
  function messageAttachmentNames(messageId: string) {
    return [...attachments.values()]
      .filter(attachment => attachment.messageId === messageId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(0, 10)
      .map(({ name }) => ({ name }))
  }

  function pickAttachment(attachment: FakeAttachment) {
    return { ...attachment }
  }

  // A text the agent wrote drawn at the counter, its cursor moved on: a conversation's reply adds to
  // its unread count, a subagent's never does
  function drawAgentText(variables: AnyVariables, run: FakeRun, { isUnread }: { isUnread: boolean }) {
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
      unreadCount: conversation.unreadCount + (isUnread ? 1 : 0),
      updatedAt: now(),
    })

    return { conversationMessage_insert: { id: id(variables.messageId) } }
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
        waitingReports: readWaitingReports(variables),
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
          .filter(message => message.runId === id(variables.runId) && !['MEMBER_TEXT', 'BRIEF'].includes(message.kind))
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
            integrationName: message.integrationName ?? null,
            integrationToolName: message.integrationToolName ?? null,
            approvalState: message.approvalState ?? null,
            run: message.runId ? { id: message.runId } : null,
            conversationAttachments_on_message: messageAttachmentNames(message.id),
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
                message =>
                  ['TOOL_CALL', 'QUESTION', 'APPROVAL'].includes(message.kind)
                  && toolUseIds.has(message.toolUseId ?? ''),
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
                integrationId: message.integrationId ?? null,
                integrationName: message.integrationName ?? null,
                integrationToolName: message.integrationToolName ?? null,
                approvalState: message.approvalState ?? null,
                approvalConfigRevision: message.approvalConfigRevision ?? null,
                approvalToolHash: message.approvalToolHash ?? null,
                approvalCredentialGeneration: message.approvalCredentialGeneration ?? null,
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
              .map(({ id: runId, number, trigger, status, leaseExpiresAt, anchorPosition }) => ({
                id: runId,
                number,
                trigger,
                status,
                leaseExpiresAt,
                anchorPosition,
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
        waitingReports: readWaitingReports(variables),
      }
    },

    GetConversationApproval: variables => {
      const message = messages.get(id(variables.messageId))
      const conversation = message && conversations.get(message.conversationId)
      const isTheirs =
        conversation !== undefined
        && conversation.id === id(variables.conversationId)
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)

      return {
        conversationMessages:
          message && isTheirs && message.kind === 'APPROVAL'
            ? [
                {
                  id: message.id,
                  toolUseId: message.toolUseId ?? null,
                  toolStatus: message.toolStatus,
                  toolOutput: message.toolOutput ?? null,
                  integrationId: message.integrationId ?? null,
                  integrationName: message.integrationName ?? null,
                  integrationToolName: message.integrationToolName ?? null,
                  approvalState: message.approvalState ?? null,
                  approvalConfigRevision: message.approvalConfigRevision ?? null,
                  approvalToolHash: message.approvalToolHash ?? null,
                  approvalCredentialGeneration: message.approvalCredentialGeneration ?? null,
                  answeredAt: message.answeredAt ?? null,
                },
              ]
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
          integrationName: message.integrationName ?? null,
          integrationToolName: message.integrationToolName ?? null,
          approvalState: message.approvalState ?? null,
          conversationAttachments_on_message: messageAttachmentNames(message.id),
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
        conversations: isTheirs
          ? [
              {
                aspects: conversation.aspects ?? [],
                parent:
                  conversation.parentId != null
                    ? { aspects: conversations.get(conversation.parentId)?.aspects ?? [] }
                    : null,
              },
            ]
          : [],
        conversationRuns: isTheirs
          ? [...runs.values()]
              .filter(run => run.conversationId === conversation.id)
              .sort((a, b) => b.number - a.number)
              .slice(0, 20)
              .map(run => ({ id: run.id, usage: run.usage ?? null }))
          : [],
        conversationAttachments: [...attachments.values()]
          .filter(attachment => isAttachmentOf(attachment, variables) && attachment.messageId !== null)
          .slice(0, 100)
          .map(({ claudeFileId, tokenCount }) => ({ claudeFileId, tokenCount })),
        parentAttachments: [...attachments.values()]
          .filter(attachment => {
            const sentBy = attachment.messageId ? messages.get(attachment.messageId) : undefined

            return (
              attachment.userId === variables.userId
              && attachment.organizationId === id(variables.organizationId)
              && sentBy !== undefined
              && conversations.get(sentBy.conversationId)?.id === conversation?.parentId
              && conversation?.parentId != null
            )
          })
          .slice(0, 100)
          .map(({ claudeFileId, tokenCount }) => ({ claudeFileId, tokenCount })),
      }
    },

    StartConversation: variables => {
      const conversationId = id(variables.conversationId)
      const runId = id(variables.runId)

      checkAttachmentCount(variables)
      checkStart(variables)

      const aspects: string[] | null = variables.aspects ?? null
      const aspectsSetBy: string | null = variables.aspectsSetBy ?? null

      if (
        aspects === null ? aspectsSetBy !== null : aspectsSetBy !== 'MEMBER' || new Set(aspects).size !== aspects.length
      ) {
        refuse('A conversation starts with the aspects its member picked, each at most once, or with none')
      }

      if (conversations.has(conversationId)) refuse('The conversation exists already')

      if (keptConversations(variables).length >= MAX_CONVERSATIONS)
        refuse('Somebody keeps at most 1000 conversations in an organization')

      checkDailyCaps(variables, 'CONVERSATION')
      checkDailyCaps(variables, 'RUN')

      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      const sent = matchSentAttachments(variables)

      conversations.set(conversationId, {
        id: conversationId,
        userId: variables.userId,
        organizationId: id(variables.organizationId),
        title: variables.title,
        aspects: aspects ?? [],
        aspectsSetBy,
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

      for (const attachment of sent) attachment.messageId = id(variables.messageId)

      recordStart(variables, 'CONVERSATION')
      recordStart(variables, 'RUN')

      return { conversation_insert: { id: conversationId } }
    },

    SendConversationMessage: variables => {
      checkAttachmentCount(variables)

      const conversation = requireSendConversation(variables)

      checkSend(conversation, variables)

      const sent = matchSentAttachments(variables)
      const deliver = deliverNamed(conversation.id, variables.deliveredSubagentIds)

      writeSend(conversation, variables)
      deliver()

      for (const attachment of sent) attachment.messageId = id(variables.messageId)

      recordStart(variables, 'RUN')

      return { conversation_updateMany: 1 }
    },

    SendConversationMessageAnsweringCalls: variables => {
      checkAttachmentCount(variables)

      const conversation = requireSendConversation(variables)
      const lastRun = runs.get(id(variables.lastRunId))
      const isLastRunWaiting =
        lastRun !== undefined && lastRun.status === 'WAITING' && lastRun.conversationId === conversation.id

      if (Number(isLastRunWaiting) !== (variables.isLastRunWaiting ? 1 : 0)) {
        refuse('The last run no longer waits as the send read it')
      }

      const skippedIds = new Set((variables.skippedQuestionIds as string[]).map(id))
      const skipped = waitingQuestions(conversation.id).filter(
        message => message.kind === 'QUESTION' && skippedIds.has(message.id),
      )

      if (skipped.length !== skippedIds.size) refuse('The questions changed since the send read them')

      const denyApprovals = updateNamed(
        waitingQuestions(conversation.id).filter(message => message.kind === 'APPROVAL'),
        variables.deniedApprovalIds,
        'The calls waiting for approval changed since the send read them',
        message =>
          Object.assign(message, {
            approvalState: 'DENIED',
            toolStatus: 'FAILED',
            toolOutput: variables.deniedApprovalOutput ?? null,
            answeredAt: now(),
          }),
      )
      const closeApprovals = updateNamed(
        allowedCalls(conversation.id),
        variables.closedApprovalIds,
        'The calls allowed changed since the send read them',
        message => Object.assign(message, { toolStatus: 'FAILED', toolOutput: variables.closedApprovalOutput ?? null }),
      )

      checkSend(conversation, variables)

      const sent = matchSentAttachments(variables)
      const deliver = deliverNamed(conversation.id, variables.deliveredSubagentIds)

      if (lastRun && isLastRunWaiting) lastRun.status = 'CONTINUED'

      for (const message of skipped) Object.assign(message, { isAnswerSkipped: true, answeredAt: now() })

      denyApprovals()
      closeApprovals()

      conversation.isAwaitingAnswer = false
      writeSend(conversation, variables)
      deliver()

      for (const attachment of sent) attachment.messageId = id(variables.messageId)

      recordStart(variables, 'RUN')

      return { conversation_updateMany: 1 }
    },

    AnswerConversationQuestion: variables => {
      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.deletedAt !== null
        || conversation.parentId != null
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
      checkDailyCaps(variables, 'RUN', { isFinishing: true })

      const conversationId = id(variables.conversationId)

      if (waitingQuestions(conversationId).length) refuse('A question of the turn still waits')
      if (allowedCalls(conversationId).length) refuse('A call the member allowed waits to run')

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
        || conversation.parentId != null
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

      const deliver = deliverNamed(conversationId, variables.deliveredSubagentIds)

      waiting.status = 'CONTINUED'
      Object.assign(conversation, {
        activeRunId: runId,
        isAwaitingAnswer: false,
        nextRunNumber: conversation.nextRunNumber + 1,
        updatedAt: now(),
      })
      runs.set(runId, queuedRun(runId, conversationId, variables, 'ANSWER', variables.transcriptPosition))
      insertEntry(entry)
      deliver()

      recordStart(variables, 'RUN')

      return { conversation_updateMany: 1 }
    },

    AnswerConversationApproval: variables => {
      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.deletedAt !== null
        || conversation.parentId != null
        || !conversation.isAwaitingAnswer
        || conversation.previewMessageId !== id(variables.previewMessageId)
      ) {
        refuse('The conversation waits for no answer, or its preview moved')
      }

      const toolStatus = variables.toolStatus ?? null
      const toolOutput = variables.toolOutput ?? null
      const isAllowed = variables.approvalState === 'ALLOWED' && toolStatus === null && toolOutput === null
      const isDenied = variables.approvalState === 'DENIED' && toolStatus === 'FAILED' && toolOutput !== null

      if (!isAllowed && !isDenied) refuse('An approval is allowed, its call left to run, or denied, failed with why')

      const waiting = runs.get(id(variables.runId))

      if (!waiting || waiting.status !== 'WAITING' || waiting.conversationId !== conversation.id) {
        refuse('The run no longer waits for an answer')
      }

      const approval = messages.get(id(variables.messageId))

      if (
        !approval
        || approval.conversationId !== conversation.id
        || approval.kind !== 'APPROVAL'
        || approval.approvalState !== 'PENDING'
        || (approval.answeredAt ?? null) !== null
      ) {
        refuse('The approval waits no more')
      }

      assignGiven(conversation, { preview: variables.preview })
      conversation.updatedAt = now()
      Object.assign(approval, { approvalState: variables.approvalState, answeredAt: now() })
      assignGiven(approval, { toolStatus: variables.toolStatus, toolOutput: variables.toolOutput })

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

    ContinueConversationRunWithCalls: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

      if (!membership) refuse('Only a member of an organization can keep conversations in it')
      if (membership.createdAt !== variables.membershipCreatedAt) {
        refuse('The membership changed since the continuation read it')
      }

      if (runsInFlight(variables.userId, variables.organizationId).length >= MAX_ACTIVE_RUNS_PER_MEMBER) {
        refuse('Somebody has at most 3 runs in flight in an organization')
      }
      checkDailyCaps(variables, 'RUN', { isFinishing: true })

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
        || conversation.parentId != null
        || conversation.activeRunId !== null
        || conversation.nextRunNumber !== variables.runNumber
      ) {
        refuse('The conversation could not take the run')
      }

      const stoppedIds = (variables.stoppedCallIds as string[]).map(id)
      const stopped = conversationMessages(conversationId).filter(
        message =>
          stoppedIds.includes(message.id)
          && message.kind === 'TOOL_CALL'
          && message.toolStatus === 'CANCELLED'
          && !message.toolStartedAt,
      )

      if (stopped.length !== stoppedIds.length) refuse("The turn's calls changed since the continuation read them")

      const runId = id(variables.runId)

      if (runs.has(runId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      waiting.status = 'CONTINUED'
      Object.assign(conversation, {
        activeRunId: runId,
        isAwaitingAnswer: false,
        nextRunNumber: conversation.nextRunNumber + 1,
        updatedAt: now(),
      })

      for (const message of stopped) {
        Object.assign(message, { toolStatus: 'FAILED', toolOutput: variables.stoppedCallOutput })
      }

      runs.set(runId, {
        ...queuedRun(runId, conversationId, variables, 'ANSWER', variables.anchorPosition),
        pendingToolResults: variables.pendingToolResults ?? null,
      })

      recordStart(variables, 'RUN')

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
        || conversation.parentId != null
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

      if (!run || run.stopRequestedAt || conversations.get(run.conversationId)?.parentId != null) {
        return { conversationRun_updateMany: 0 }
      }

      run.stopRequestedAt = now()

      return { conversationRun_updateMany: 1 }
    },

    RequestConversationRunStopWithSubagents: variables => {
      const run = findOwnedRun(variables, 'RUNNING')

      if (run && !run.stopRequestedAt && conversations.get(run.conversationId)?.parentId == null) {
        run.stopRequestedAt = now()
      }

      askSubagentRunsToStop(id(variables.conversationId), { anchorPosition: variables.anchorPosition })

      return { conversationRun_updateMany: run ? 1 : 0 }
    },

    StopQueuedConversationRunWithSubagents: variables => {
      const run = findQueuedRun(variables)

      if (!run || conversations.get(run.conversationId)?.parentId != null) refuse('The run is no longer queued')

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'STOPPED')
      run.failure = 'Its member stopped it while it was queued'
      writeNote(conversation, variables, 'STOPPED')
      askSubagentRunsToStop(conversation.id, { anchorPosition: variables.anchorPosition })

      return { conversationRun_updateMany: 1 }
    },

    RequestConversationSubagentsStop: variables => {
      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.parentId != null
        || conversation.deletedAt !== null
      ) {
        refuse("No such conversation of the caller's")
      }

      return {
        parent: 1,
        subagentRuns: askSubagentRunsToStop(conversation.id, {
          anchorPosition: variables.anchorPosition ?? undefined,
          subagentIds: variables.subagentIds ?? undefined,
        }),
      }
    },

    GetSubagentsToStop: variables => ({
      conversations: [...conversations.values()]
        .filter(
          subagent =>
            subagent.parentId === id(variables.conversationId)
            && subagent.userId === variables.userId
            && subagent.organizationId === id(variables.organizationId)
            && subagent.activeRunId !== null
            && (variables.anchorPosition == null || subagent.launchAnchorPosition === variables.anchorPosition)
            && (variables.subagentIds == null || (variables.subagentIds as string[]).map(id).includes(subagent.id)),
        )
        .slice(0, 100)
        .map(subagent => ({
          id: subagent.id,
          activeRunId: subagent.activeRunId,
          latestRuns: latestRuns(subagent.id)
            .slice(0, 1)
            .map(({ id: runId, status, stopRequestedAt }) => ({ id: runId, status, stopRequestedAt })),
        })),
    }),

    StopQueuedConversationRun: variables => {
      const run = findQueuedRun(variables)

      if (!run || conversations.get(run.conversationId)?.parentId != null) refuse('The run is no longer queued')

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
      checkDailyCaps(variables, 'RUN')

      if (
        conversation.deletedAt !== null
        || conversation.parentId != null
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

      recordStart(variables, 'RUN')

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
      checkDailyCaps(variables, 'RUN')

      if (
        conversation.deletedAt !== null
        || conversation.parentId != null
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

      // The live subagents the runs it cuts launched, asked to stop and deleted at an instant of
      // their own, a moment after any delete before it
      askSubagentRunsToStop(conversation.id, { anchorPosition: variables.anchorPosition, isLiveOnly: true })

      for (const subagent of conversations.values()) {
        if (
          subagent.parentId === conversation.id
          && subagent.launchAnchorPosition === variables.anchorPosition
          && subagent.deletedAt === null
        ) {
          subagent.deletedAt = stamp()
        }
      }

      recordStart(variables, 'RUN')

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

    DrawConversationAgentText: variables => drawAgentText(variables, requireFencedRun(variables), { isUnread: true }),

    DrawSubagentAgentText: variables => drawAgentText(variables, requireSubagentRun(variables), { isUnread: false }),

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
        ...integrationFields(variables),
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
        ...integrationFields(variables),
        approvalConfigRevision: variables.approvalConfigRevision ?? null,
        approvalToolHash: variables.approvalToolHash ?? null,
        approvalCredentialGeneration: variables.approvalCredentialGeneration ?? null,
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

    DrawConversationApproval: variables => {
      const run = requireFencedRun(variables)

      if (!(variables.toBlock > variables.fromBlock) || [...variables.argumentsPreview].length > 2001) {
        refuse('An approval is drawn from its call, with a preview of at most 2000 characters and its ellipsis')
      }

      const conversation = requireDrawConversation(variables)
      const entry = requireDrawEntry(run, variables)

      insertMessage({
        id: id(variables.messageId),
        conversationId: conversation.id,
        runId: run.id,
        kind: 'APPROVAL',
        text: null,
        noteKind: null,
        toolStatus: null,
        position: variables.position,
        toolUseId: variables.toolUseId,
        toolName: variables.toolName,
        toolInput: variables.toolInput,
        toolOutput: null,
        toolStartedAt: null,
        ...integrationFields(variables),
        approvalState: 'PENDING',
        approvalConfigRevision: variables.approvalConfigRevision,
        approvalToolHash: variables.approvalToolHash,
        approvalCredentialGeneration: variables.approvalCredentialGeneration ?? null,
        argumentsPreview: variables.argumentsPreview,
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

    StartConversationIntegrationCall: variables => {
      const run = requireFencedRun(variables)
      const message = messages.get(id(variables.messageId))
      const isStartable =
        message
        && message.conversationId === run.conversationId
        && message.integrationId === id(variables.integrationId)
        && !message.toolStartedAt
        && ((message.kind === 'TOOL_CALL' && ['RUNNING', 'CANCELLED'].includes(message.toolStatus ?? ''))
          || (message.kind === 'APPROVAL' && message.approvalState === 'ALLOWED'))

      if (!isStartable) refuse('The call started already, or was never allowed')

      run.leaseExpiresAt = inSeconds(60)
      Object.assign(message, { toolStatus: 'RUNNING', toolStartedAt: now() })

      const server = integrations.integrations.get(id(variables.integrationId))

      if (
        server
        && server.organizationId === id(variables.organizationId)
        && (!server.lastUsedAt || Date.parse(server.lastUsedAt) < Date.now() - 60_000)
      ) {
        server.lastUsedAt = now()
      }

      return { conversationMessage_updateMany: 1 }
    },

    FinishConversationIntegrationCall: variables => {
      const run = requireFencedRun(variables)
      const approvalState = variables.approvalState ?? null

      if (!['SUCCEEDED', 'FAILED'].includes(variables.toolStatus) || ![null, 'DENIED'].includes(approvalState)) {
        refuse('A call finishes succeeded or failed, and an approval it finishes can only be denied')
      }

      const message = messages.get(id(variables.messageId))

      if (
        !message
        || message.conversationId !== run.conversationId
        || !['TOOL_CALL', 'APPROVAL'].includes(message.kind)
        || !message.integrationId
        || !['RUNNING', 'CANCELLED'].includes(message.toolStatus ?? '')
        || !message.toolStartedAt
      ) {
        refuse('The call is no longer running')
      }

      Object.assign(run, { pendingToolResults: variables.pendingToolResults, leaseExpiresAt: inSeconds(60) })
      Object.assign(message, {
        toolStatus: variables.toolStatus,
        toolOutput: variables.toolOutput,
        ...(variables.toolDurationMs === undefined ? {} : { toolDurationMs: variables.toolDurationMs }),
        ...(approvalState === null ? {} : { approvalState }),
      })

      const conversation = conversations.get(run.conversationId)

      if (conversation?.previewMessageId === message.id) conversation.preview = variables.preview

      return { conversationMessage_updateMany: 1 }
    },

    DeleteConversationModuleCallResults: variables => {
      const scopes = new Set(variables.scopes as string[])
      let deleted = 0

      for (const [key, result] of modules.results) {
        if (scopes.has(result.idempotencyScope)) {
          modules.results.delete(key)
          deleted++
        }
      }

      return { moduleCallResult_deleteMany: deleted }
    },

    SettleConversationToolCall: variables => {
      const message = messages.get(id(variables.messageId))
      const conversation = message ? conversations.get(message.conversationId) : undefined

      if (
        !message
        || !conversation
        || message.kind !== 'TOOL_CALL'
        || !['RUNNING', 'CANCELLED'].includes(message.toolStatus ?? '')
        || !message.toolStartedAt
        || conversation.id !== id(variables.conversationId)
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.deletedAt !== null
        || conversation.activeRunId !== null
      ) {
        return { conversationMessage_updateMany: 0 }
      }

      Object.assign(message, { toolStatus: 'SUCCEEDED', toolOutput: variables.toolOutput })

      return { conversationMessage_updateMany: 1 }
    },

    StoreConversationToolResults: variables => {
      const run = requireFencedRun(variables)
      const anchorPosition = variables.anchorPosition ?? null

      if (anchorPosition !== null && anchorPosition !== variables.position) {
        refuse('A run is anchored on the results it stores, or where it was')
      }

      const deliver = deliverNamed(run.conversationId, variables.deliveredSubagentIds)

      insertEntry({
        id: id(variables.entryId),
        conversationId: run.conversationId,
        runId: run.id,
        position: variables.position,
        role: 'USER',
        content: variables.content,
        drawnBlocks: 0,
      })
      Object.assign(run, {
        pendingToolResults: null,
        leaseExpiresAt: inSeconds(60),
        ...(anchorPosition === null ? {} : { anchorPosition }),
      })
      deliver()

      return { conversationTranscriptEntry_insert: { id: id(variables.entryId) } }
    },

    TagConversationAspects: variables => {
      const run = requireFencedRun(variables)
      const aspects: string[] = variables.aspects

      if (aspects.length < 1 || aspects.length > 3 || new Set(aspects).size !== aspects.length) {
        refuse('The agent tags a conversation with one to three aspects, each at most once')
      }

      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.deletedAt !== null
        || (conversation.aspectsSetBy ?? null) !== null
        || conversation.nextMessagePosition !== variables.position
        || conversation.messageCount >= MAX_CONVERSATION_MESSAGES
      ) {
        refuse('The conversation could not be tagged at that position')
      }

      insertMessage({
        id: id(variables.noteId),
        conversationId: conversation.id,
        runId: null,
        kind: 'ASPECTS',
        text: null,
        noteKind: null,
        toolStatus: null,
        position: variables.position,
        aspects,
        aspectsSetBy: 'AGENT',
      })
      run.leaseExpiresAt = inSeconds(60)
      run.usage = variables.usage
      Object.assign(conversation, {
        aspects,
        aspectsSetBy: 'AGENT',
        nextMessagePosition: conversation.nextMessagePosition + 1,
        messageCount: conversation.messageCount + 1,
      })

      return {
        conversationRun_updateMany: 1,
        conversation_updateMany: 1,
        conversationMessage_insert: { id: id(variables.noteId) },
      }
    },

    FinishConversationRunWaiting: variables => {
      const run = requireParentRun(variables)

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
      const run = requireParentRun(variables)

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
      const run = requireParentRun(variables)

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

    FinishConversationRunFull: variables => {
      const run = requireParentRun(variables)
      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'FAILED')
      assignGiven(run, { usage: variables.usage, failure: variables.failure })
      writeNote(conversation, variables, 'FULL')
      assignGiven(conversation, { isFull: variables.isFull })
      for (const subagent of waitingReports(conversation.id)) subagent.reportDeliveredAt = now()

      return { conversationRun_updateMany: 1 }
    },

    GetSubagentReactionContext: variables => {
      const conversationId = id(variables.conversationId)
      const conversation = conversations.get(conversationId)
      const isTheirs =
        conversation !== undefined
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const [latest] = isTheirs ? latestRuns(conversationId) : []
      const [lastEntry] = isTheirs ? conversationEntries(conversationId) : []

      return {
        userOrganization: memberships.get(membershipKey(variables.userId, variables.organizationId)) ?? null,
        conversation: conversation
          ? { ...conversation, isAwaitingAnswer: conversation.isAwaitingAnswer ?? false }
          : null,
        latestRuns: latest
          ? [
              {
                id: latest.id,
                number: latest.number,
                status: latest.status,
                notes: [...messages.values()]
                  .filter(message => message.runId === latest.id && message.kind === 'NOTE')
                  .slice(0, 1)
                  .map(({ noteKind }) => ({ noteKind })),
              },
            ]
          : [],
        lastEntries: lastEntry ? [{ position: lastEntry.position }] : [],
        subagents: [...conversations.values()]
          .filter(
            subagent =>
              subagent.parentId === conversationId
              && subagent.userId === variables.userId
              && subagent.organizationId === id(variables.organizationId)
              && subagent.deletedAt === null,
          )
          .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
          .slice(0, 100)
          .map(subagent => ({
            id: subagent.id,
            title: subagent.title,
            launchAnchorPosition: subagent.launchAnchorPosition ?? null,
            report: subagent.report ?? null,
            reportedAt: subagent.reportedAt ?? null,
            reportDeliveredAt: subagent.reportDeliveredAt ?? null,
            latestRuns: latestRuns(subagent.id)
              .slice(0, 1)
              .map(({ status }) => ({ status })),
          })),
        conversationRuns: runsInFlight(variables.userId, variables.organizationId).map(run => ({
          id: run.id,
          status: run.status,
          leaseExpiresAt: run.leaseExpiresAt,
          conversation: { id: run.conversationId },
        })),
      }
    },

    GetDueSubagentReactions: variables => ({
      conversations: reactingConversations()
        .filter(
          conversation =>
            conversation.userId === variables.userId && conversation.organizationId === id(variables.organizationId),
        )
        .slice(0, 1000)
        .map(({ id: conversationId }) => ({ id: conversationId })),
    }),

    GetSubagentReactionSweepMembers: variables => ({
      users: [...new Set(reactingConversations().map(({ userId }) => userId))]
        .filter(userId => userId > variables.afterUserId)
        .sort()
        .slice(0, 100)
        .map(userId => ({ id: userId })),
    }),

    GetSubagentReactionSweepOrganizations: variables => ({
      organizations: [
        ...new Set(
          reactingConversations()
            .filter(({ userId }) => userId === variables.userId)
            .map(({ organizationId }) => organizationId),
        ),
      ]
        .slice(0, 1000)
        .map(organizationId => ({ id: organizationId })),
    }),

    GetDeadConversationRunSweep: () => ({
      conversationRuns: [...runs.values()]
        .filter(run => {
          const conversation = conversations.get(run.conversationId)

          return RUN_IN_FLIGHT.includes(run.status) && isPast(run.leaseExpiresAt) && conversation?.parentId == null
        })
        .sort((a, b) => (a.leaseExpiresAt ?? '').localeCompare(b.leaseExpiresAt ?? '') || a.id.localeCompare(b.id))
        .slice(0, 100)
        .flatMap(run => {
          const conversation = conversations.get(run.conversationId)

          return conversation
            ? [
                {
                  id: run.id,
                  status: run.status,
                  leaseExpiresAt: run.leaseExpiresAt,
                  conversation: {
                    id: conversation.id,
                    userId: conversation.userId,
                    organizationId: conversation.organizationId,
                  },
                },
              ]
            : []
        }),
    }),

    StartSubagentReaction: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))
      const subagentIds: string[] = (variables.subagentIds as string[]).map(id)

      if (!membership) refuse('Only a member of an organization can keep conversations in it')
      if (subagentIds.length < 1 || subagentIds.length > 100) refuse('A reaction delivers 1 to 100 reports')

      const conversationId = id(variables.conversationId)
      const conversation = conversations.get(conversationId)

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.deletedAt !== null
        || conversation.parentId != null
        || conversation.activeRunId !== null
        || conversation.isAwaitingAnswer
        || conversation.nextRunNumber !== variables.runNumber
      ) {
        refuse('The conversation could not take the reaction')
      }

      if (membership.createdAt !== variables.membershipCreatedAt) {
        refuse('The membership changed since the reaction read it')
      }

      if (runsInFlight(variables.userId, variables.organizationId).length >= MAX_ACTIVE_RUNS_PER_MEMBER) {
        refuse('Somebody has at most 3 runs in flight in an organization')
      }
      checkDailyCaps(variables, 'RUN', { isFinishing: true })

      const [completed] = latestRuns(conversationId).filter(run => run.status === 'COMPLETED')

      if (completed?.number !== variables.runNumber - 1)
        refuse('A conversation reacts only once its latest run completed')

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

      const delivered = waitingReports(conversationId).filter(subagent => subagentIds.includes(subagent.id))

      if (delivered.length !== subagentIds.length) refuse('The reports changed since the reaction read them')

      Object.assign(conversation, {
        activeRunId: runId,
        nextRunNumber: conversation.nextRunNumber + 1,
        updatedAt: now(),
      })
      runs.set(runId, queuedRun(runId, conversationId, variables, 'REPORTS', variables.transcriptPosition))
      insertEntry(entry)

      for (const subagent of delivered) subagent.reportDeliveredAt = now()

      recordStart(variables, 'RUN')

      return { parent: 1, delivered: delivered.length }
    },

    MarkSubagentReportsDelivered: variables => {
      const conversationId = id(variables.conversationId)
      const conversation = conversations.get(conversationId)
      const subagentIds: string[] = (variables.subagentIds as string[]).map(id)

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.parentId != null
      ) {
        refuse("No such conversation of the caller's")
      }

      if (subagentIds.length > 100) refuse('A conversation holds at most 100 subagents')
      if (latestRuns(conversationId).some(run => run.number > variables.parentRunNumber)) {
        refuse('The conversation started a run since it was full')
      }

      const delivered = waitingReports(conversationId).filter(subagent => subagentIds.includes(subagent.id))

      for (const subagent of delivered) subagent.reportDeliveredAt = now()

      return { parent: 1, delivered: delivered.length }
    },

    ClaimDeletedConversations: () => {
      let claimed = 0

      for (const conversation of conversations.values()) {
        if (
          isPastUndo(conversation)
          && conversation.pruneClaimedAt === null
          && (conversation.parentId == null || conversation.activeRunId === null)
        ) {
          conversation.pruneClaimedAt = now()
          claimed++
        }
      }

      return { conversation_updateMany: claimed }
    },

    GetClaimedConversations: () => ({
      conversations: [...conversations.values()]
        .filter(
          conversation =>
            conversation.pruneClaimedAt !== null && isPastUndo(conversation) && conversation.parentId == null,
        )
        .slice(0, 20)
        .map(({ id: conversationId, userId, organizationId }) => ({ id: conversationId, userId, organizationId })),
    }),

    GetClaimedSubagents: () => ({
      conversations: [...conversations.values()]
        .filter(
          conversation =>
            conversation.pruneClaimedAt !== null && isPastUndo(conversation) && conversation.parentId != null,
        )
        .sort((a, b) => (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.id.localeCompare(b.id))
        .slice(0, 100)
        .map(({ id: conversationId, parentId }) => ({ id: conversationId, parentId })),
    }),

    GetConversationsWithSubagents: ({ ids }) => ({
      conversations: [...conversations.values()]
        .filter(
          conversation => conversation.parentId != null && (ids as string[]).map(id).includes(conversation.parentId),
        )
        .slice(0, 1000)
        .map(({ parentId }) => ({ parentId })),
    }),

    PruneClaimedSubagents: variables => {
      const ids = (variables.ids as string[]).map(id)

      if (variables.count !== ids.length || variables.count > 100) refuse('A prune names each subagent it counts')

      const pruned = ids.filter(subagentId => {
        const subagent = conversations.get(subagentId)

        return (
          subagent !== undefined
          && subagent.parentId === id(variables.parentId)
          && subagent.pruneClaimedAt !== null
          && isPastUndo(subagent)
        )
      })

      if (pruned.length !== variables.count) refuse('The subagents changed since the prune read them')

      const parent = conversations.get(id(variables.parentId))

      if (parent) parent.subagentCount = (parent.subagentCount ?? 0) - variables.count

      for (const subagentId of pruned) deleteConversation(subagentId)

      return { parent: parent ? 1 : 0, subagents: pruned.length }
    },

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
        || conversation.parentId != null
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

    FinishSubagentRun: variables => {
      const run = requireSubagentRun(variables)

      if (variables.status !== 'COMPLETED' && variables.status !== 'STOPPED') {
        refuse('A run ends this way completed or stopped')
      }

      checkReport(variables)

      const conversation = conversations.get(id(variables.conversationId))

      if (!conversation || (conversation.activeRunId !== null && conversation.activeRunId !== run.id)) {
        refuse('The subagent could not take its report')
      }

      end(run, variables.status)
      assignGiven(run, { usage: variables.usage })
      cancelRunningCalls(run.conversationId)
      conversation.activeRunId = null
      writeReport(conversation, variables)

      return { conversationRun_updateMany: 1 }
    },

    FinishSubagentRunWithNote: variables => {
      const run = requireSubagentRun(variables)
      const notes: Record<string, string[]> = { FAILED: ['FAILED', 'FULL'], STOPPED: ['STOPPED'], REFUSED: ['REFUSED'] }

      if (!notes[variables.status]?.includes(variables.noteKind)) {
        refuse('A run ends with its own note: failed or full, stopped, or refused')
      }

      checkReport(variables)

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, variables.status)
      assignGiven(run, { usage: variables.usage, failure: variables.failure })
      writeNote(conversation, variables, variables.noteKind)
      assignGiven(conversation, { isFull: variables.isFull })
      writeReport(conversation, variables)

      return { conversationRun_updateMany: 1 }
    },

    InterruptSubagentRun: variables => {
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
        || conversation.parentId == null
      ) {
        refuse("The run is no longer this worker's")
      }

      checkReport(variables)

      const noteConversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'INTERRUPTED')
      assignGiven(run, { failure: variables.failure })
      writeNote(noteConversation, variables, 'INTERRUPTED')
      writeReport(noteConversation, variables)

      return { conversationRun_updateMany: 1 }
    },

    GetSubagentLaunchContext: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))
      const parent = conversations.get(id(variables.parentId))
      const subagent = conversations.get(id(variables.subagentId))
      const isTheirs = (conversation: FakeConversation | undefined): conversation is FakeConversation =>
        conversation !== undefined
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)
      const attachmentIds = (variables.attachmentIds as string[]).map(id)

      return {
        userOrganization: membership ? { createdAt: membership.createdAt } : null,
        parent: parent
          ? {
              userId: parent.userId,
              organizationId: parent.organizationId,
              deletedAt: parent.deletedAt,
              parentId: parent.parentId ?? null,
              subagentCount: parent.subagentCount ?? 0,
            }
          : null,
        latestRuns: isTheirs(parent)
          ? latestRuns(parent.id)
              .slice(0, 1)
              .map(({ anchorPosition }) => ({ anchorPosition }))
          : [],
        subagents: [...conversations.values()]
          .filter(
            conversation =>
              conversation.parentId === id(variables.parentId)
              && isTheirs(conversation)
              && conversation.deletedAt === null,
          )
          .slice(0, 100)
          .map(({ launchAnchorPosition }) => ({ launchAnchorPosition: launchAnchorPosition ?? null })),
        files: [...attachments.values()]
          .filter(
            attachment =>
              attachmentIds.includes(attachment.id)
              && isAttachmentOf(attachment, { ...variables, conversationId: variables.parentId }),
          )
          .slice(0, 10)
          .map(({ id: attachmentId, status, messageId, name, contentType, tokenCount, claudeFileId, createdAt }) => ({
            id: attachmentId,
            status,
            messageId,
            name,
            contentType,
            tokenCount,
            claudeFileId,
            createdAt,
          })),
        subagent: subagent
          ? { userId: subagent.userId, organizationId: subagent.organizationId, parentId: subagent.parentId ?? null }
          : null,
        subagentRuns: isTheirs(subagent)
          ? [...runs.values()]
              .filter(run => run.conversationId === subagent.id && run.number === 0)
              .map(({ id: runId, status, leaseExpiresAt }) => ({ id: runId, status, leaseExpiresAt }))
          : [],
        activeSubagentRuns: subagentRuns(variables.userId, variables.organizationId, RUN_IN_FLIGHT)
          .slice(0, MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER)
          .map(({ id: runId, status, leaseExpiresAt, conversationId }) => ({
            id: runId,
            status,
            leaseExpiresAt,
            conversation: { id: conversationId },
          })),
      }
    },

    LaunchSubagent: variables => launchSubagent(variables, { isPending: false }),

    LaunchPendingSubagent: variables => launchSubagent(variables, { isPending: true }),

    GetSubagentLauncherForAgent: variables => {
      const run = runs.get(id(variables.runId))
      const conversation = conversations.get(id(variables.conversationId))
      const isTheirs =
        run
        && conversation
        && run.conversationId === conversation.id
        && conversation.userId === variables.userId
        && conversation.organizationId === id(variables.organizationId)

      return {
        membership: moduleMembership(variables),
        runs: isTheirs
          ? [
              {
                status: run.status,
                trigger: run.trigger,
                stopRequestedAt: run.stopRequestedAt,
                anchorPosition: run.anchorPosition,
                conversation: { parentId: conversation.parentId ?? null, deletedAt: conversation.deletedAt },
              },
            ]
          : [],
      }
    },

    LaunchSubagentForAgent: variables => launchSubagent(variables, { isPending: false, isForAgent: true }),

    LaunchPendingSubagentForAgent: variables => launchSubagent(variables, { isPending: true, isForAgent: true }),

    ListSubagentsForAgent: variables => ({
      membership: moduleMembership(variables),
      subagents: liveSubagents(variables)
        .slice(0, MAX_CONVERSATION_SUBAGENTS)
        .map(subagent => ({
          id: subagent.id,
          title: subagent.title,
          createdAt: subagent.createdAt ?? '',
          reportedAt: subagent.reportedAt ?? null,
          reportDeliveredAt: subagent.reportDeliveredAt ?? null,
          latestRuns: latestRuns(subagent.id)
            .slice(0, 1)
            .map(({ status }) => ({ status })),
        })),
    }),

    GetSubagentForAgent: variables => ({
      membership: moduleMembership(variables),
      subagents: liveSubagents(variables)
        .filter(subagent => subagent.id === id(variables.id))
        .map(subagent => ({
          id: subagent.id,
          title: subagent.title,
          createdAt: subagent.createdAt ?? '',
          activeRunId: subagent.activeRunId,
          nextMessagePosition: subagent.nextMessagePosition,
          report: subagent.report ?? null,
          reportedAt: subagent.reportedAt ?? null,
          latestRuns: latestRuns(subagent.id)
            .slice(0, 1)
            .map(({ id: runId, number, status, step, stopRequestedAt }) => ({
              id: runId,
              number,
              status,
              step,
              stopRequestedAt,
            })),
          runCount: [{ _count: latestRuns(subagent.id).length }],
        })),
    }),

    GetSubagentWritesForAgent: variables => {
      const written = [...modules.results.values()]
        .filter(
          result =>
            result.idempotencyScope === variables.scope
            && result.userId === variables.userId
            && result.organizationId === id(variables.organizationId),
        )
        .sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.idempotencyKey < b.idempotencyKey ? -1 : 1,
        )

      return {
        membership: moduleMembership(variables),
        writes: written
          .filter(
            result =>
              result.createdAt > variables.afterCreatedAt
              || (result.createdAt === variables.afterCreatedAt && result.idempotencyKey > variables.afterKey),
          )
          .slice(0, 51)
          .map(({ idempotencyKey, tool, result, createdAt }) => ({ idempotencyKey, tool, result, createdAt })),
        total: [{ _count: written.length }],
      }
    },

    RequestSubagentRunStopForAgent: variables => {
      if (moduleMembership(variables).length === 0) refuse('The caller is no longer a member of the organization')

      modules.checkKey(variables)

      const launcher = runs.get(id(variables.launchRunId))
      const launching = launcher && conversations.get(launcher.conversationId)

      if (
        !launcher
        || !launching
        || launcher.status !== 'RUNNING'
        || launcher.stopRequestedAt !== null
        || launching.id !== id(variables.parentId)
        || launching.userId !== variables.userId
        || launching.organizationId !== id(variables.organizationId)
        || launching.parentId != null
        || launching.deletedAt !== null
      ) {
        refuse('The run stopping the subagent has ended or was asked to stop')
      }

      modules.insertResult(variables)

      const run = runs.get(id(variables.runId))
      const subagent = run && conversations.get(run.conversationId)

      if (
        !run
        || !subagent
        || !['QUEUED', 'RUNNING', 'PENDING'].includes(run.status)
        || run.stopRequestedAt !== null
        || subagent.id !== id(variables.conversationId)
        || subagent.parentId !== id(variables.parentId)
        || subagent.userId !== variables.userId
        || subagent.organizationId !== id(variables.organizationId)
        || subagent.deletedAt !== null
      ) {
        refuse("The subagent's run is no longer the one to stop")
      }

      run.stopRequestedAt = now()
      modules.storeResult(variables)

      return { conversationRun_updateMany: 1 }
    },

    GetSubagentSlots: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

      return {
        userOrganization: membership ? { createdAt: membership.createdAt } : null,
        activeRuns: subagentRuns(variables.userId, variables.organizationId, RUN_IN_FLIGHT)
          .slice(0, MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER)
          .map(({ id: runId, status, leaseExpiresAt, conversationId }) => ({
            id: runId,
            status,
            leaseExpiresAt,
            conversation: { id: conversationId },
          })),
        pendingRuns: subagentRuns(variables.userId, variables.organizationId, ['PENDING'])
          .slice(0, 100)
          .map(({ id: runId, createdAt, membershipCreatedAt, stopRequestedAt, conversationId }) => ({
            id: runId,
            createdAt,
            membershipCreatedAt,
            stopRequestedAt,
            conversation: { id: conversationId, deletedAt: conversations.get(conversationId)?.deletedAt ?? null },
          })),
      }
    },

    GetSubagentPendingRuns: variables => {
      const pending = subagentRuns(variables.userId, variables.organizationId, ['PENDING'])
      const isDeleted = (run: FakeRun) => conversations.get(run.conversationId)?.deletedAt != null
      const isPromotable = (run: FakeRun) =>
        run.membershipCreatedAt === variables.membershipCreatedAt && run.stopRequestedAt === null && !isDeleted(run)

      return {
        activeRuns: subagentRuns(variables.userId, variables.organizationId, RUN_IN_FLIGHT)
          .slice(0, MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER)
          .map(({ id: runId }) => ({ id: runId })),
        promotableRuns: pending
          .filter(isPromotable)
          .slice(0, MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER)
          .map(({ id: runId, conversationId }) => ({ id: runId, conversation: { id: conversationId } })),
        skippedRuns: pending
          .filter(run => !isPromotable(run))
          .slice(0, 100)
          .map(({ id: runId, membershipCreatedAt, stopRequestedAt, conversationId }) => ({
            id: runId,
            membershipCreatedAt,
            stopRequestedAt,
            conversation: { id: conversationId, deletedAt: conversations.get(conversationId)?.deletedAt ?? null },
          })),
      }
    },

    GetSubagentSweepMembers: variables => ({
      users: [...new Set(sweptRuns().map(({ conversation }) => conversation.userId))]
        .filter(userId => userId > variables.afterUserId)
        .sort()
        .slice(0, 100)
        .map(userId => ({ id: userId })),
    }),

    GetSubagentSweepOrganizations: variables => ({
      organizations: [
        ...new Set(
          sweptRuns()
            .filter(({ conversation }) => conversation.userId === variables.userId)
            .map(({ conversation }) => conversation.organizationId),
        ),
      ]
        .slice(0, 1000)
        .map(organizationId => ({ id: organizationId })),
    }),

    ChainSubagentRun: variables => {
      const run = requireSubagentRun(variables)
      const conversation = conversations.get(run.conversationId)

      if (
        !conversation
        || run.number !== variables.runNumber
        || run.anchorPosition !== variables.anchorPosition
        || run.stopRequestedAt !== null
        || conversation.deletedAt !== null
      ) {
        refuse("The run is no longer this worker's")
      }

      if (!(variables.runNumber < 3 && variables.nextRunNumber === variables.runNumber + 1)) {
        refuse("A subagent's run chains to the run right after it, before its fourth")
      }

      if (conversation.activeRunId !== run.id || conversation.nextRunNumber !== variables.nextRunNumber) {
        refuse('The subagent could not take the run its run chains to')
      }

      const nextRunId = id(variables.nextRunId)

      if (runs.has(nextRunId)) refuse('violates SQL unique constraint: conversation_run_pkey')

      end(run, 'CHAINED')
      assignGiven(run, { usage: variables.usage, failure: variables.failure })
      Object.assign(conversation, { activeRunId: nextRunId, nextRunNumber: conversation.nextRunNumber + 1 })
      runs.set(nextRunId, {
        ...queuedRun(
          nextRunId,
          conversation.id,
          { ...variables, runNumber: variables.nextRunNumber },
          'CONTINUE',
          variables.anchorPosition,
        ),
        pendingToolResults: variables.pendingToolResults ?? null,
      })

      return { conversationRun_updateMany: 1 }
    },

    PromoteSubagentRun: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))

      if (!membership) refuse('Only a member of an organization has subagents in it')
      if (membership.createdAt !== variables.membershipCreatedAt) {
        refuse('The membership changed since the promotion read it')
      }

      if (
        subagentRuns(variables.userId, variables.organizationId, RUN_IN_FLIGHT).length
        >= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER
      ) {
        refuse("Every one of the member's 5 subagent slots is taken")
      }

      const run = runs.get(id(variables.runId))
      const conversation = run && conversations.get(run.conversationId)

      if (
        !run
        || !conversation
        || run.status !== 'PENDING'
        || run.membershipCreatedAt !== variables.membershipCreatedAt
        || run.stopRequestedAt !== null
        || conversation.id !== id(variables.conversationId)
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.parentId == null
        || conversation.deletedAt !== null
      ) {
        refuse('The run is no longer waiting for a slot')
      }

      Object.assign(run, { status: 'QUEUED', createdAt: now(), leaseExpiresAt: inSeconds(20 * 60) })

      return { conversationRun_updateMany: 1 }
    },

    StopQueuedSubagentRun: variables => {
      const run = findQueuedRun(variables)

      if (!run || run.stopRequestedAt === null || conversations.get(run.conversationId)?.parentId == null) {
        refuse('The run is no longer queued to be stopped')
      }

      checkReport(variables)

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'STOPPED')
      assignGiven(run, { failure: variables.failure })
      writeNote(conversation, variables, 'STOPPED')
      writeReport(conversation, variables)

      return { conversationRun_updateMany: 1 }
    },

    StopPendingSubagentRun: variables => {
      const run = requirePendingRun(variables, 'The run no longer waits to be stopped')

      if (run.stopRequestedAt === null && conversations.get(run.conversationId)?.deletedAt == null) {
        refuse('The run no longer waits to be stopped')
      }

      checkReport(variables)

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'STOPPED')
      assignGiven(run, { failure: variables.failure })
      writeNote(conversation, variables, 'STOPPED')
      writeReport(conversation, variables)

      return { conversationRun_updateMany: 1 }
    },

    InterruptPendingSubagentRun: variables => {
      const run = requirePendingRun(variables, 'The run no longer waits to be interrupted')

      if (
        run.membershipCreatedAt !== variables.membershipCreatedAt
        || memberships.get(membershipKey(variables.userId, variables.organizationId))?.createdAt
          === variables.membershipCreatedAt
      ) {
        refuse('The run no longer waits to be interrupted')
      }

      checkReport(variables)

      const conversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'INTERRUPTED')
      assignGiven(run, { failure: variables.failure })
      writeNote(conversation, variables, 'INTERRUPTED')
      writeReport(conversation, variables)

      return { conversationRun_updateMany: 1 }
    },

    InterruptDeadSubagentRun: variables => {
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
        || conversation.parentId == null
      ) {
        refuse('The run is not dead')
      }

      checkReport(variables)

      const noteConversation = requireNoteConversation(variables)

      if (messages.has(id(variables.noteId))) refuse('violates SQL unique constraint: conversation_message_pkey')

      end(run, 'INTERRUPTED')
      assignGiven(run, { failure: variables.failure })
      writeNote(noteConversation, variables, 'INTERRUPTED')
      writeReport(noteConversation, variables)

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
          .slice(0, 5001)
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

    GetCappedStarts: variables => {
      const read = (kind: CappedStartKind, scope: CapScope, limit: number) =>
        todaysStarts(variables, kind, scope)
          .slice(0, limit)
          .map(({ createdAt }) => ({ createdAt }))

      return {
        memberConversations: read('CONVERSATION', 'member', MAX_DAILY_CONVERSATIONS_PER_MEMBER),
        accountConversations: read('CONVERSATION', 'account', MAX_DAILY_CONVERSATIONS_PER_ACCOUNT),
        organizationConversations: read('CONVERSATION', 'organization', MAX_DAILY_CONVERSATIONS_PER_ORGANIZATION),
        memberRuns: read('RUN', 'member', MAX_DAILY_RUNS_PER_MEMBER * DAILY_CAP_OVERRUN_FACTOR),
        accountRuns: read('RUN', 'account', MAX_DAILY_RUNS_PER_ACCOUNT * DAILY_CAP_OVERRUN_FACTOR),
        organizationRuns: read('RUN', 'organization', MAX_DAILY_RUNS_PER_ORGANIZATION * DAILY_CAP_OVERRUN_FACTOR),
        memberSubagents: read('SUBAGENT', 'member', MAX_DAILY_SUBAGENTS_PER_MEMBER),
        accountSubagents: read('SUBAGENT', 'account', MAX_DAILY_SUBAGENTS_PER_ACCOUNT),
      }
    },

    DeleteExpiredCappedStarts: () => {
      const before = Date.now() - 24 * 60 * 60 * 1000
      let deleted = 0

      for (const start of cappedStarts.values()) {
        if (Date.parse(start.createdAt) < before) {
          cappedStarts.delete(start.id)
          deleted++
        }
      }

      return { cappedStart_deleteMany: deleted }
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

    GetConversationAttachmentUploadContext: variables => {
      const membership = memberships.get(membershipKey(variables.userId, variables.organizationId))
      const conversation = conversations.get(id(variables.conversationId))
      const attachment = attachments.get(id(variables.attachmentId))

      return {
        userOrganization: membership ? { createdAt: membership.createdAt } : null,
        conversation: conversation
          ? {
              userId: conversation.userId,
              organizationId: conversation.organizationId,
              deletedAt: conversation.deletedAt,
              parentId: conversation.parentId ?? null,
            }
          : null,
        conversationAttachment: attachment ? pickAttachment(attachment) : null,
      }
    },

    ReserveConversationAttachment: variables => {
      if (!memberships.has(membershipKey(variables.userId, variables.organizationId))) {
        refuse('Only a member of an organization can send files in it')
      }

      const name = String(variables.name)

      if (
        [...name].length < 1
        || [...name].length > MAX_CONVERSATION_ATTACHMENT_NAME_LENGTH
        || /[\r\n]/.test(name)
        || variables.size < 1
        || variables.size > MAX_CONVERSATION_ATTACHMENT_SIZE
        || !CONVERSATION_ATTACHMENT_CONTENT_TYPES.includes(variables.contentType)
      ) {
        refuse(
          'A file has a name on one line of at most 200 characters, a type a conversation takes, and at most 10 MiB',
        )
      }

      const conversation = conversations.get(id(variables.conversationId))

      if (
        conversation
        && (conversation.userId !== variables.userId
          || conversation.organizationId !== id(variables.organizationId)
          || conversation.deletedAt !== null
          || conversation.parentId != null)
      ) {
        refuse("The conversation is somebody else's, deleted or a subagent")
      }

      if (
        pendingAttachments(variables.userId, variables.organizationId).length >= MAX_PENDING_CONVERSATION_ATTACHMENTS
      ) {
        refuse('Somebody has at most 30 files waiting to be sent in an organization')
      }

      const attachmentId = id(variables.attachmentId)

      if (attachments.has(attachmentId)) refuse('violates SQL unique constraint: conversation_attachment_pkey')

      attachments.set(attachmentId, {
        id: attachmentId,
        userId: variables.userId,
        organizationId: id(variables.organizationId),
        conversationId: id(variables.conversationId),
        messageId: null,
        status: 'UPLOADING',
        name,
        contentType: variables.contentType,
        size: variables.size,
        pageCount: null,
        tokenCount: null,
        claudeFileId: null,
        createdAt: stamp(),
      })

      return { conversationAttachment_insert: { id: attachmentId } }
    },

    CompleteConversationAttachmentUpload: variables => {
      const attachment = attachments.get(id(variables.attachmentId))

      if (!attachment || !isAttachmentOf(attachment, variables) || attachment.status !== 'UPLOADING') {
        refuse('The file is no longer being uploaded')
      }

      Object.assign(attachment, {
        status: 'READY',
        pageCount: variables.pageCount ?? null,
        tokenCount: variables.tokenCount,
        claudeFileId: variables.claudeFileId,
      })

      return { conversationAttachment_updateMany: 1 }
    },

    ClaimExpiredMemberConversationAttachments: variables => {
      let claimed = 0

      for (const attachment of attachments.values()) {
        if (
          attachment.userId === variables.userId
          && attachment.organizationId === id(variables.organizationId)
          && isExpiredAttachment(attachment)
        ) {
          attachment.status = 'PRUNING'
          claimed++
        }
      }

      return { conversationAttachment_updateMany: claimed }
    },

    ClaimExpiredConversationAttachments: () => {
      let claimed = 0

      for (const attachment of attachments.values()) {
        if (isExpiredAttachment(attachment)) {
          attachment.status = 'PRUNING'
          claimed++
        }
      }

      return { conversationAttachment_updateMany: claimed }
    },

    ReleaseConversationAttachment: variables => {
      const attachment = attachments.get(id(variables.attachmentId))

      if (
        !attachment
        || !isAttachmentOf(attachment, variables)
        || attachment.status !== 'UPLOADING'
        || attachment.messageId !== null
      ) {
        return { conversationAttachment_updateMany: 0 }
      }

      attachment.status = 'PRUNING'

      return { conversationAttachment_updateMany: 1 }
    },

    ClaimConversationAttachment: variables => {
      const attachment = attachments.get(id(variables.attachmentId))

      if (
        !attachment
        || !isAttachmentOf(attachment, variables)
        || !['UPLOADING', 'READY'].includes(attachment.status)
        || attachment.messageId !== null
      ) {
        return { conversationAttachment_updateMany: 0 }
      }

      attachment.status = 'PRUNING'

      return { conversationAttachment_updateMany: 1 }
    },

    DeletePrunedConversationAttachments: ({ ids }) => {
      let deleted = 0

      for (const attachmentId of (ids as string[]).map(id)) {
        const attachment = attachments.get(attachmentId)

        if (attachment && attachment.status === 'PRUNING' && attachment.messageId === null) {
          attachments.delete(attachmentId)
          deleted++
        }
      }

      return { conversationAttachment_deleteMany: deleted }
    },

    DeleteConversationAttachments: variables => {
      const conversation = conversations.get(id(variables.conversationId))

      if (
        !conversation
        || conversation.userId !== variables.userId
        || conversation.organizationId !== id(variables.organizationId)
        || conversation.pruneClaimedAt === null
        || !isPastUndo(conversation)
      ) {
        refuse('Only a conversation a prune claimed loses its files')
      }

      let deleted = 0

      for (const attachment of attachments.values()) {
        if (isAttachmentOf(attachment, variables)) {
          attachments.delete(attachment.id)
          deleted++
        }
      }

      return { conversationAttachment_deleteMany: deleted }
    },

    GetConversationAttachment: variables => {
      const attachment = attachments.get(id(variables.attachmentId))
      const conversation = conversations.get(id(variables.conversationId))

      return {
        conversationAttachments:
          attachment && isAttachmentOf(attachment, variables) ? [pickAttachment(attachment)] : [],
        conversation: conversation
          ? {
              userId: conversation.userId,
              organizationId: conversation.organizationId,
              deletedAt: conversation.deletedAt,
            }
          : null,
      }
    },

    GetConversationSendAttachments: variables => {
      const ids: string[] = (variables.attachmentIds as string[]).map(id)
      const theirs = [...attachments.values()].filter(attachment => isAttachmentOf(attachment, variables))

      return {
        named: theirs
          .filter(attachment => ids.includes(attachment.id))
          .slice(0, 10)
          .map(pickAttachment),
        sent: theirs
          .filter(attachment => attachment.messageId !== null)
          .slice(0, 100)
          .map(({ contentType, size, pageCount }) => ({ contentType, size, pageCount })),
      }
    },

    GetPruningMemberConversationAttachments: variables => ({
      conversationAttachments: [...attachments.values()]
        .filter(
          attachment =>
            attachment.userId === variables.userId
            && attachment.organizationId === id(variables.organizationId)
            && attachment.status === 'PRUNING'
            && attachment.messageId === null,
        )
        .slice(0, 100)
        .map(pickAttachment),
    }),

    GetPruningConversationAttachments: () => ({
      conversationAttachments: [...attachments.values()]
        .filter(attachment => attachment.status === 'PRUNING' && attachment.messageId === null)
        .slice(0, 100)
        .map(pickAttachment),
    }),

    GetConversationPruneAttachments: variables => ({
      conversationAttachments: [...attachments.values()]
        .filter(attachment => isAttachmentOf(attachment, variables))
        .slice(0, 200)
        .map(pickAttachment),
    }),

    GetOrganizationConversationAttachmentFiles: variables => ({
      conversationAttachments: [...attachments.values()]
        .filter(
          attachment =>
            attachment.organizationId === id(variables.organizationId)
            && attachment.claudeFileId !== null
            && attachment.claudeFileId > variables.afterClaudeFileId,
        )
        .sort((a, b) => String(a.claudeFileId).localeCompare(String(b.claudeFileId)))
        .slice(0, 100)
        .map(({ claudeFileId }) => ({ claudeFileId })),
    }),

    GetConversationAttachmentsByClaudeFileIds: variables => ({
      conversationAttachments: [...attachments.values()]
        .filter(attachment => (variables.claudeFileIds as string[]).includes(attachment.claudeFileId ?? ''))
        .slice(0, 100)
        .map(({ claudeFileId }) => ({ claudeFileId })),
    }),
  }

  // The generated SDK's names: `startConversation(dataConnect, variables)` for `StartConversation`
  const sdk: Record<string, unknown> = {
    ...integrations.sdk,
    ...modules.sdk,
    ConversationActor,
    ConversationApprovalState,
    ConversationAttachmentStatus,
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

      const data = operation(variables)

      await fake.afterOperation(name, variables)

      return { data }
    }
  }

  // Empties every table, for the next test
  function reset() {
    for (const table of [
      users,
      memberships,
      conversations,
      runs,
      messages,
      entries,
      searches,
      attachments,
      cappedStarts,
    ]) {
      table.clear()
    }

    calls.length = 0
    fake.beforeOperation = async () => {}
    fake.afterOperation = async () => {}
    modules.reset()
    integrations.reset()
  }

  return Object.assign(fake, { sdk, addMember, removeMember, deleteAsMember, restore, markRead, reset })
}

export type ConversationDatabaseFake = ReturnType<typeof createConversationDatabaseFake>

export default createConversationDatabaseFake
