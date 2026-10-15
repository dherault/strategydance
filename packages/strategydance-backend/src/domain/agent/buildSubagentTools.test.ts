import { describe, expect, it, mock } from 'bun:test'
import { createHash } from 'node:crypto'

import createModuleDatabaseFake from '~domain/modules/testing/createModuleDatabaseFake'

const fake = createModuleDatabaseFake()

mock.module('~firebase', () => ({ dataConnect: {} }))
mock.module('strategydance-database/backend', () => fake.sdk)

const { default: connectConversationModules } = await import('./connectConversationModules')
const { default: buildSubagentTools } = await import('./buildSubagentTools')
const { default: buildConversationTools } = await import('./buildConversationTools')
const { default: CONVERSATION_TOOLS } = await import('./conversationTools')

// The modules' tools as a subagent's worker lists them, through their own handlers
async function readModuleTools() {
  const organizationId = '0f9c2b8e4b1a4d2c9e7f6a5b4c3d2e1f'
  const modules = await connectConversationModules({
    organizationId,
    userId: 'member',
    conversationId: '1a2b3c4d5e6f40718293a4b5c6d7e8f9',
    membershipCreatedAt: fake.addMember('member', organizationId),
  })

  await modules.close()

  return modules.tools
}

// A tool's name, which every tool the agent sends has
function readName(tool: ReturnType<typeof buildSubagentTools>[number]) {
  return 'name' in tool ? tool.name : tool.type
}

describe('buildSubagentTools', () => {
  /*
    Its bytes, like its system prompt's, are what every subagent's history was made with, so a change
    to them makes every existing subagent lose its earlier reasoning once. Change this hash only with
    a release that means to change the tools
  */
  it('keeps its bytes, web search then the Knowledge module’s and the Tasks module’s', async () => {
    const tools = buildSubagentTools(await readModuleTools())

    expect(tools.map(readName)).toEqual([
      'web_search',
      'search_documents',
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'set_document_aspects',
      'delete_document',
      'restore_document',
      'list_tasks',
      'read_task',
      'create_task',
      'update_task',
      'add_task_dependency',
      'remove_task_dependency',
      'delete_task',
      'restore_task',
    ])
    expect(createHash('sha256').update(JSON.stringify(tools)).digest('hex')).toBe(
      'dcae656f977ba6e076205cdc7ce4334992208927091050dc05e285c0bf3f9134',
    )
  })

  // Nobody answers a subagent's question or approves its call
  it('sends every tool of a conversation’s but the agent’s own, web search aside, each as a conversation sends it', async () => {
    const moduleTools = await readModuleTools()
    const subagent = buildSubagentTools(moduleTools).map(tool => JSON.stringify(tool))
    const conversation = buildConversationTools(moduleTools).map(tool => JSON.stringify(tool))
    const ownNames = CONVERSATION_TOOLS.map(readName).filter(name => name !== 'web_search')

    expect(subagent.every(tool => conversation.includes(tool))).toBe(true)
    expect(conversation.filter(tool => !subagent.includes(tool)).map(tool => JSON.parse(tool).name)).toEqual(ownNames)
  })
})
