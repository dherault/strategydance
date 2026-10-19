import { randomUUID } from 'node:crypto'

import { initializeApp } from 'firebase-admin/app'
import { getDataConnect } from 'firebase-admin/data-connect'
import {
  ConversationActor,
  ConversationRunStatus,
  CompanyAspect,
  claimQueuedConversationRun,
  connectorConfig,
  finishConversationRun,
  getConversationSendContext,
  startConversation,
} from 'strategydance-database/backend'

import { FIREBASE_PROJECT_ID } from '~constants'

import { dataConnect } from '~firebase'

// The browser's connector, on an app of its own, since the Admin SDK keeps one instance a service
export const webConnector = getDataConnect(
  { ...connectorConfig, connector: 'strategydance-web-connector' },
  initializeApp({ projectId: FIREBASE_PROJECT_ID }, 'web-connector'),
)

type Variables = Record<string, unknown>

// Dashless, as the emulator writes a UUID back, so an id read compares with the one made
export function createId() {
  return randomUUID().replaceAll('-', '')
}

const checkId = createId().slice(0, 8)
const organizationIds: string[] = []
const userIds: string[] = []

async function write(query: string, variables: Variables = {}) {
  await dataConnect.executeGraphql(query, { variables })
}

export async function read<Data>(query: string, variables: Variables = {}) {
  const { data } = await dataConnect.executeGraphql<Data, Variables>(query, { variables })

  return data
}

export type Member = { organizationId: string; userId: string; membershipCreatedAt: string }

/*
  A member of an organization of their own, made for one round of one scenario, so nothing another
  round left counts against their runs, their slots or their caps
*/
export async function createMember(scenario: string, round: number): Promise<Member> {
  const userId = `race-${checkId}-${scenario}-${round}`
  const organizationId = createId()

  userIds.push(userId)
  organizationIds.push(organizationId)

  // Signed up as the app has them, since a user's row takes its id and address off the token
  await webConnector.executeMutation(
    'CreateCurrentUser',
    { locale: 'EN', authenticationProviders: [] },
    { impersonate: { authClaims: { sub: userId, email: `${userId}@example.com` } } },
  )
  await write(
    `mutation SetUp($organizationId: UUID!, $userId: String!) {
      organization_insert(data: { id: $organizationId, name: "Raced organization" })
      userOrganization_insert(data: { userId: $userId, organizationId: $organizationId, role: MEMBER })
    }`,
    { organizationId, userId },
  )

  const { data } = await getConversationSendContext(dataConnect, {
    organizationId,
    userId,
    conversationId: createId(),
    messageId: createId(),
  })

  if (!data.userOrganization) throw new Error(`${userId} is not a member`)

  return { organizationId, userId, membershipCreatedAt: data.userOrganization.createdAt }
}

export async function tearDown() {
  await write(
    `mutation TearDown($organizationIds: [UUID!]!, $userIds: [String!]!) {
      organization_deleteMany(where: { id: { in: $organizationIds } })
      user_deleteMany(where: { id: { in: $userIds } })
    }`,
    { organizationIds, userIds },
  )
}

// A web connector's operation run as the member, as their token would
export function asMember(member: Member) {
  return {
    run: (name: string, variables: Variables) =>
      webConnector.executeMutation(name, variables, {
        impersonate: { authClaims: { sub: member.userId, email: `${member.userId}@example.com` } },
      }),
  }
}

export type Fence = {
  organizationId: string
  userId: string
  conversationId: string
  runId: string
  attempts: number
  membershipCreatedAt: string
}

// Claims a queued run as its worker does, answering the fence its writes take
export async function claim(member: Member, conversationId: string, runId: string): Promise<Fence> {
  const reference = { organizationId: member.organizationId, userId: member.userId, conversationId, runId }

  await claimQueuedConversationRun(dataConnect, {
    ...reference,
    attempts: 0,
    membershipCreatedAt: member.membershipCreatedAt,
  })

  return { ...reference, attempts: 1, membershipCreatedAt: member.membershipCreatedAt }
}

/*
  A conversation of the member's whose first run completed, as a conversation is between messages,
  tagged, so nothing would tag it. Unless asked to leave its run queued
*/
export async function startConversationOf(member: Member, { isIdle = true } = {}) {
  const conversationId = createId()
  const runId = createId()

  await startConversation(dataConnect, {
    organizationId: member.organizationId,
    userId: member.userId,
    conversationId,
    runId,
    membershipCreatedAt: member.membershipCreatedAt,
    messageId: createId(),
    title: 'Raced conversation',
    text: 'Raced message',
    preview: { kind: 'MEMBER_TEXT', text: 'Raced message' },
    content: JSON.stringify([{ type: 'text', text: 'Raced message' }]),
    aspects: [CompanyAspect.FINANCES],
    aspectsSetBy: ConversationActor.MEMBER,
    isUsageCapped: false,
  })

  if (isIdle) {
    await finishConversationRun(dataConnect, {
      ...(await claim(member, conversationId, runId)),
      status: ConversationRunStatus.COMPLETED,
    })
  }

  return { conversationId, runId }
}

export type StoredConversation = {
  id: string
  parentId: string | null
  activeRunId: string | null
  isAwaitingAnswer: boolean
  nextMessagePosition: number
  nextRunNumber: number
  messageCount: number
  subagentCount: number
  deletedAt: string | null
  report: string | null
  reportedAt: string | null
  reportDeliveredAt: string | null
  launchAnchorPosition: number | null
}

const CONVERSATION_FIELDS = `id parentId activeRunId isAwaitingAnswer nextMessagePosition nextRunNumber messageCount
  subagentCount deletedAt report reportedAt reportDeliveredAt launchAnchorPosition`

export async function readConversation(id: string) {
  const data = await read<{ conversation: StoredConversation | null }>(
    `query ReadConversation($id: UUID!) { conversation(id: $id) { ${CONVERSATION_FIELDS} } }`,
    { id },
  )

  return data.conversation
}

// The member's own conversations, subagents left out
export async function readConversationsOf(member: Member) {
  const data = await read<{ conversations: StoredConversation[] }>(
    `query ReadConversationsOf($organizationId: UUID!, $userId: String!) {
      conversations(where: { organizationId: { eq: $organizationId }, userId: { eq: $userId }, parentId: { isNull: true } }) {
        ${CONVERSATION_FIELDS}
      }
    }`,
    { organizationId: member.organizationId, userId: member.userId },
  )

  return data.conversations
}

export async function readSubagents(parentId: string) {
  const data = await read<{ conversations: StoredConversation[] }>(
    `query ReadSubagents($parentId: UUID!) {
      conversations(where: { parentId: { eq: $parentId } }) { ${CONVERSATION_FIELDS} }
    }`,
    { parentId },
  )

  return data.conversations
}

export type StoredRun = {
  id: string
  number: number
  trigger: string
  status: string
  attempts: number
  anchorPosition: number
  stopRequestedAt: string | null
  leaseExpiresAt: string | null
  startedAt: string | null
  failure: string | null
  usage: unknown
  conversation: { id: string }
}

const RUN_FIELDS =
  'id number trigger status attempts anchorPosition stopRequestedAt leaseExpiresAt startedAt failure usage conversation { id }'

export async function readRuns(conversationId: string) {
  const data = await read<{ conversationRuns: StoredRun[] }>(
    `query ReadRuns($conversationId: UUID!) {
      conversationRuns(where: { conversation: { id: { eq: $conversationId } } }, orderBy: [{ number: ASC }]) { ${RUN_FIELDS} }
    }`,
    { conversationId },
  )

  return data.conversationRuns
}

// The member's runs in flight in their own conversations, which they keep three of at most
export async function readRunsInFlight(member: Member) {
  const data = await read<{ conversationRuns: StoredRun[] }>(
    `query ReadRunsInFlight($organizationId: UUID!, $userId: String!) {
      conversationRuns(
        where: {
          status: { in: [QUEUED, RUNNING] }
          conversation: { organizationId: { eq: $organizationId }, userId: { eq: $userId }, parentId: { isNull: true } }
        }
      ) { ${RUN_FIELDS} }
    }`,
    { organizationId: member.organizationId, userId: member.userId },
  )

  return data.conversationRuns
}

export type StoredMessage = { id: string; kind: string; position: number; noteKind: string | null }

export async function readMessages(conversationId: string) {
  const data = await read<{ conversationMessages: StoredMessage[] }>(
    `query ReadMessages($conversationId: UUID!) {
      conversationMessages(where: { conversation: { id: { eq: $conversationId } } }, orderBy: [{ position: ASC }]) {
        id kind position noteKind
      }
    }`,
    { conversationId },
  )

  return data.conversationMessages
}

export type StoredEntry = { position: number; role: string; content: string }

export async function readTranscript(conversationId: string) {
  const data = await read<{ conversationTranscriptEntries: StoredEntry[] }>(
    `query ReadTranscript($conversationId: UUID!) {
      conversationTranscriptEntries(where: { conversation: { id: { eq: $conversationId } } }, orderBy: [{ position: ASC }]) {
        position role content
      }
    }`,
    { conversationId },
  )

  return data.conversationTranscriptEntries
}

// The member's subagent runs holding one of their five slots, and those waiting for one, every one
// of them, where `GetSubagentSlots` reads no more than a launch needs to know
export async function readSlots(member: Member) {
  const data = await read<{ conversationRuns: StoredRun[] }>(
    `query ReadSlots($organizationId: UUID!, $userId: String!) {
      conversationRuns(
        where: {
          status: { in: [QUEUED, RUNNING, PENDING] }
          conversation: { organizationId: { eq: $organizationId }, userId: { eq: $userId }, parentId: { isNull: false } }
        }
      ) { ${RUN_FIELDS} }
    }`,
    { organizationId: member.organizationId, userId: member.userId },
  )

  return {
    activeRuns: data.conversationRuns.filter(({ status }) => status !== 'PENDING'),
    pendingRuns: data.conversationRuns.filter(({ status }) => status === 'PENDING'),
  }
}

// Whether two ids are one, whatever their hyphens
export function isSameId(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.replaceAll('-', '').toLowerCase() === b.replaceAll('-', '').toLowerCase()
}
