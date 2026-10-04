import { createHash } from 'node:crypto'

import { buildConversationPreview, type ConversationPreviewSource } from 'strategydance-core'

import { dataConnect } from '~firebase'

import {
  buildSeedConversations,
  SEED_DOCUMENTS,
  type SeedConversation,
  type SeedDocumentKey,
  type SeedEntry,
} from './conversationSeeds'

/*
  Gives somebody the design's conversations in the emulators, and nowhere else, in every
  organization they belong to:

    bun run seed:conversations <email>

  Nothing creates a conversation before the send route does, so the pages that read them are built
  and checked against these. It writes the rows as the backend will, every position, counter and
  time set, each preview built by `buildConversationPreview`, with the knowledge documents the
  replies link to. The thread is drawn and nothing more: no transcript entry is written, so the
  agent would read a seeded conversation as one that starts with the next message.

  Ids are derived from the account, the organization and each row's place in the seed, so a second
  run deletes the seeded conversations and writes them afresh, putting back any deleted meanwhile.
  A document is written only when it is missing, so what somebody typed in one stays.

  Ad hoc GraphQL through the Admin SDK, as `grantAdministrator.ts` sends, so no seed operation is
  ever deployed, and for the same reason the script refuses to run unless it points at the emulator
*/
if (!process.env.DATA_CONNECT_EMULATOR_HOST) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set. This script only writes to the emulators: run `bun run seed:conversations <email>`',
  )
  process.exit(1)
}

// Firebase lowercases the addresses it stores, which are the ones the rows mirror
const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Usage: bun run seed:conversations <email>')
  process.exit(1)
}

type Membership = { organizationId: string; createdAt: string; organization: { name: string } }

const { data } = await dataConnect.executeGraphql<
  { users: { id: string; isAdministrator: boolean; userOrganizations_on_user: Membership[] }[] },
  { email: string }
>(
  `query FindSeededUser($email: String!) {
    users(where: { email: { eq: $email } }, limit: 1) {
      id
      isAdministrator
      userOrganizations_on_user(limit: 100) {
        organizationId
        createdAt
        organization { name }
      }
    }
  }`,
  { variables: { email } },
)

const user = data.users[0]

if (!user) {
  console.error(`Nobody has signed in as ${email} in the emulators yet. Sign in once, then run this again`)
  process.exit(1)
}

if (!user.userOrganizations_on_user.length) {
  console.error(`${email} belongs to no organization yet. Finish the onboarding, then run this again`)
  process.exit(1)
}

const userId = user.id
const now = Date.now()

function toTime(ago: number) {
  return new Date(now - ago).toISOString()
}

// A UUID derived from the seed's own names, the same on every run, as a version 4 one is laid out
function seedId(...parts: string[]) {
  const hex = createHash('sha256').update(parts.join(':')).digest('hex')

  return `${hex.slice(0, 12)}4${hex.slice(13, 16)}${((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 32)}`
}

// A rich text value as the editor stores it, one paragraph a line
function toRichText(paragraphs: string[]) {
  return JSON.stringify(
    paragraphs.map(text => ({ type: 'paragraph', content: [{ type: 'text', text, styles: {} }], children: [] })),
  )
}

async function seedDocuments(organizationId: string) {
  const documentIds = Object.fromEntries(
    SEED_DOCUMENTS.map(({ key }) => [key, seedId(userId, organizationId, 'document', key)]),
  ) as Record<SeedDocumentKey, string>

  const { data: existing } = await dataConnect.executeGraphql<{ documents: { id: string }[] }, { ids: string[] }>(
    `query FindSeededDocuments($ids: [UUID!]!) {
      documents(where: { id: { in: $ids } }, limit: 100) { id }
    }`,
    { variables: { ids: Object.values(documentIds) } },
  )

  // The ids are made without hyphens, as the emulator writes a UUID back, so they compare as read
  const existingIds = new Set(existing.documents.map(({ id }) => id))
  const missing = SEED_DOCUMENTS.filter(({ key }) => !existingIds.has(documentIds[key]))

  if (missing.length) {
    await dataConnect.executeGraphql(
      `mutation SeedDocuments($rows: [Document_Data!]!) {
        document_insertMany(data: $rows)
      }`,
      {
        variables: {
          rows: missing.map(document => ({
            id: documentIds[document.key],
            organizationId,
            createdById: userId,
            title: document.title,
            aspects: document.aspects,
            content: toRichText(document.paragraphs),
            createdAt: toTime(document.ago),
            updatedAt: toTime(document.ago),
          })),
        },
      },
    )
  }

  return { documentIds, createdCount: missing.length }
}

function toPreviewSource(entry: SeedEntry): ConversationPreviewSource {
  switch (entry.kind) {
    case 'MEMBER_TEXT':
    case 'AGENT_TEXT':
      return { kind: entry.kind, text: entry.text }
    case 'TOOL_CALL':
      return { kind: entry.kind, toolName: entry.toolName, toolStatus: entry.toolStatus }
    case 'QUESTION':
      return {
        kind: entry.kind,
        questionPrompt: entry.questionPrompt,
        answerSelected: entry.answer && 'selected' in entry.answer ? entry.answer.selected : null,
        answerOther: entry.answer && 'selected' in entry.answer ? (entry.answer.other ?? null) : null,
        isAnswerSkipped: Boolean(entry.answer && 'isSkipped' in entry.answer),
      }
    case 'ASPECTS':
      return { kind: entry.kind }
    case 'NOTE':
      return { kind: entry.kind, noteKind: entry.noteKind }
  }
}

// The columns of an entry's own kind, the others left null as the table has them
function toMessageFields(entry: SeedEntry) {
  switch (entry.kind) {
    case 'MEMBER_TEXT':
    case 'AGENT_TEXT':
      return { text: entry.text }
    case 'TOOL_CALL':
      return {
        toolUseId: `toolu_seed_${createHash('sha256').update(JSON.stringify(entry)).digest('hex').slice(0, 24)}`,
        toolName: entry.toolName,
        toolStatus: entry.toolStatus,
        toolInput: JSON.stringify(entry.toolInput),
        toolOutput: entry.toolOutput === undefined ? null : JSON.stringify(entry.toolOutput),
        toolStartedAt: toTime(entry.ago),
        toolDurationMs: entry.toolDurationMs ?? null,
      }
    case 'QUESTION':
      if (!entry.answer) {
        return {
          questionPrompt: entry.questionPrompt,
          questionOptions: entry.questionOptions,
          isMultipleChoice: entry.isMultipleChoice,
        }
      }

      return {
        questionPrompt: entry.questionPrompt,
        questionOptions: entry.questionOptions,
        isMultipleChoice: entry.isMultipleChoice,
        answerSelected: 'selected' in entry.answer ? entry.answer.selected : null,
        answerOther: 'selected' in entry.answer ? (entry.answer.other ?? null) : null,
        isAnswerSkipped: 'isSkipped' in entry.answer,
        answeredAt: toTime(entry.answer.ago),
      }
    case 'ASPECTS':
      return { aspects: entry.aspects, aspectsSetBy: entry.aspectsSetBy }
    case 'NOTE':
      return { noteKind: entry.noteKind }
  }
}

function buildRows(conversation: SeedConversation, membership: Membership) {
  const { organizationId } = membership
  const conversationId = seedId(userId, organizationId, 'conversation', conversation.key)

  const runs = conversation.runs.map((run, number) => ({ run, number, id: seedId(conversationId, 'run', `${number}`) }))
  const entries = [
    ...runs.flatMap(({ run, id }) => run.entries.map(entry => ({ entry, runId: id as string | null }))),
    ...(conversation.after ?? []).map(entry => ({ entry, runId: null })),
  ]

  const messages = entries.map(({ entry, runId }, position) => ({
    id: seedId(conversationId, 'message', `${position}`),
    conversationId,
    runId,
    kind: entry.kind,
    position,
    createdAt: toTime(entry.ago),
    ...toMessageFields(entry),
  }))

  let position = 0

  const runRows = runs.map(({ run, number, id }) => {
    const anchorPosition = position
    const lastEntry = run.entries.at(-1)!

    position += run.entries.length

    return {
      id,
      conversationId,
      number,
      trigger: run.trigger,
      status: run.status,
      step: run.step ?? null,
      membershipCreatedAt: membership.createdAt,
      anchorPosition,
      attempts: 1,
      createdAt: toTime(run.ago),
      startedAt: toTime(run.ago - 1000),
      // A run in flight holds a lease a minute long, past which the page shows it interrupted
      leaseExpiresAt: run.status === 'RUNNING' ? new Date(now + 60_000).toISOString() : null,
      stopRequestedAt: run.status === 'STOPPED' ? toTime(lastEntry.ago) : null,
      endedAt: run.status === 'RUNNING' ? null : toTime(lastEntry.ago),
    }
  })

  // The last entry that is not an aspects note is what the list shows
  const previewIndex = entries.findLastIndex(({ entry }) => entry.kind !== 'ASPECTS')
  const previewEntry = entries[previewIndex]
  const activeRun = runs.find(({ run }) => run.status === 'RUNNING')
  const latestRun = runs.at(-1)

  return {
    conversation: {
      id: conversationId,
      userId,
      organizationId,
      title: conversation.title,
      aspects: conversation.aspects,
      aspectsSetBy: conversation.aspectsSetBy,
      activeRunId: activeRun?.id ?? null,
      isAwaitingAnswer: latestRun?.run.status === 'WAITING',
      preview: previewEntry ? buildConversationPreview(toPreviewSource(previewEntry.entry)) : null,
      previewMessageId: previewEntry ? messages[previewIndex]!.id : null,
      unreadCount: conversation.unreadCount,
      nextRunNumber: runs.length,
      nextMessagePosition: messages.length,
      messageCount: messages.length,
      createdAt: messages[0]?.createdAt ?? toTime(conversation.updatedAgo),
      updatedAt: toTime(conversation.updatedAgo),
    },
    runs: runRows,
    messages,
  }
}

for (const membership of user.userOrganizations_on_user) {
  const { organizationId } = membership
  const { documentIds, createdCount } = await seedDocuments(organizationId)
  const conversations = buildSeedConversations(documentIds).map(conversation => buildRows(conversation, membership))

  // Deleting a conversation deletes its messages and runs with it
  await dataConnect.executeGraphql(
    `mutation UnseedConversations($ids: [UUID!]!) {
      conversation_deleteMany(where: { id: { in: $ids } })
    }`,
    { variables: { ids: conversations.map(({ conversation }) => conversation.id) } },
  )

  for (const rows of conversations) {
    await dataConnect.executeGraphql(
      `mutation SeedConversation(
        $conversation: Conversation_Data!
        $runs: [ConversationRun_Data!]!
        $messages: [ConversationMessage_Data!]!
      ) @transaction {
        conversation_insert(data: $conversation)
        conversationRun_insertMany(data: $runs)
        conversationMessage_insertMany(data: $messages)
      }`,
      { variables: rows },
    )
  }

  console.log(
    `Seeded ${conversations.length} conversations, and ${createdCount} of their ${SEED_DOCUMENTS.length} documents, in ${membership.organization.name}`,
  )
}

if (!user.isAdministrator) {
  console.log(
    `Conversations show to administrators of Strategy Dance only for now: run \`bun run grant:administrator ${email}\` to see them`,
  )
}
