import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import type { ConversationRunReference } from '~types'

import createConversationDatabaseFake from '~domain/conversations/testing/createConversationDatabaseFake'
import createConversationTestKit, { ORGANIZATION_ID } from '~domain/conversations/testing/createConversationTestKit'
import createSubagentsCaller from '~domain/subagents/testing/createSubagentsCaller'

const fake = createConversationDatabaseFake()
const kit = createConversationTestKit(fake)

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('~utils/logger', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: createModuleTestKit } = await import('~modules/testing/createModuleTestKit')
const { default: createKnowledgeTestDocuments } =
  await import('~modules/knowledge/testing/createKnowledgeTestDocuments')

const documents = createKnowledgeTestDocuments(fake.modules, ORGANIZATION_ID)

// A run of a conversation's, claimed by its worker and running, started as `trigger` starts one
async function startRunning(trigger: string) {
  const parent = await kit.start()

  await kit.claim(parent)

  const run = fake.runs.get(parent.runId)

  if (run) run.trigger = trigger as typeof run.trigger

  return parent
}

// The Knowledge and Tasks modules as the run's worker reaches them, the run as their launcher
function connect(name: 'knowledge' | 'tasks', launching: ConversationRunReference) {
  return createModuleTestKit(
    name,
    createSubagentsCaller(fake, launching, { scopes: [`${name}:read`, `${name}:write`] }),
  )
}

beforeEach(() => {
  fake.addMember('author', ORGANIZATION_ID)
})

afterEach(() => fake.reset())

describe("the deletes, from a parent's reaction to its subagents' reports", () => {
  it('refuse a reaction’s delete_document and delete_task with a sentence asking the member, deleting nothing', async () => {
    const reaction = await startRunning('REPORTS')
    const documentId = documents.store('The old pricing page').id
    const task = fake.modules.insertTask({ organizationId: ORGANIZATION_ID, name: 'Retire the old pricing' })
    const knowledge = await connect('knowledge', reaction)
    const tasks = await connect('tasks', reaction)

    expect(await knowledge.refusal('delete_document', { id: documentId }, 'toolu_document')).toBe(
      "This run reacts to subagents' reports, and deletes nothing. Ask the member with ask_user whether the document should go: the run their answer starts can delete it.",
    )
    expect(await tasks.refusal('delete_task', { id: task.id }, 'toolu_task')).toBe(
      "This run reacts to subagents' reports, and deletes nothing. Ask the member with ask_user whether the task should go: the run their answer starts can delete it.",
    )
    expect(fake.modules.documents.get(documentId)?.deletedAt ?? null).toBeNull()
    expect(fake.modules.tasks.get(task.id)?.deletedAt ?? null).toBeNull()
  })

  it('let the run the member’s answer starts delete what a report proposed', async () => {
    const continuation = await startRunning('ANSWER')
    const documentId = documents.store('The old pricing page').id
    const task = fake.modules.insertTask({ organizationId: ORGANIZATION_ID, name: 'Retire the old pricing' })

    await (await connect('knowledge', continuation)).answer('delete_document', { id: documentId }, 'toolu_document')
    await (await connect('tasks', continuation)).answer('delete_task', { id: task.id }, 'toolu_task')

    expect(fake.modules.documents.get(documentId)?.deletedAt).toEqual(expect.any(String))
    expect(fake.modules.tasks.get(task.id)?.deletedAt).toEqual(expect.any(String))
  })
})
