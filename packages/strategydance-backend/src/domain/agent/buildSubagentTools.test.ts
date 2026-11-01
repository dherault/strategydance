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
  it('keeps its bytes, web search and the integration tools then the Documents module’s, the Tasks module’s, the Budget module’s and the Knowledge module’s, their deletes left out', async () => {
    const tools = buildSubagentTools(await readModuleTools())

    expect(tools.map(readName)).toEqual([
      'web_search',
      'list_integrations',
      'describe_integration_tool',
      'call_integration_tool',
      'search_documents',
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'set_document_aspects',
      'restore_document',
      'list_tasks',
      'read_task',
      'create_task',
      'update_task',
      'add_task_dependency',
      'remove_task_dependency',
      'restore_task',
      'read_budget',
      'list_bills',
      'read_bill',
      'add_bill',
      'update_bill',
      'restore_bill',
      'list_knowledge',
      'read_knowledge',
      'set_knowledge_in_use',
      'link_knowledge',
      'unlink_knowledge',
    ])
    expect(createHash('sha256').update(JSON.stringify(tools)).digest('hex')).toBe(
      'a41d12c04e8e3ea1edd255a2f96cfaa06859bfe4d04016c18e139ed9091b5120',
    )
  })

  // Nobody answers a subagent's question, what it would delete it proposes, and it is one level deep.
  // Its calls to integrations it reaches as its agent does, those that would wait refused when drawn
  it('sends every tool of a conversation’s but ask_user, the deletes and the Subagents module’s, each as a conversation sends it, in its order', async () => {
    const moduleTools = await readModuleTools()
    const subagent = buildSubagentTools(moduleTools).map(tool => JSON.stringify(tool))
    const conversation = buildConversationTools(moduleTools).map(tool => JSON.stringify(tool))

    expect(conversation.filter(tool => subagent.includes(tool))).toEqual(subagent)
    expect(subagent.slice(0, 4)).toEqual(
      CONVERSATION_TOOLS.filter(tool => readName(tool) !== 'ask_user').map(tool => JSON.stringify(tool)),
    )
    expect(conversation.filter(tool => !subagent.includes(tool)).map(tool => JSON.parse(tool).name)).toEqual([
      'ask_user',
      'delete_document',
      'delete_task',
      'delete_bill',
      'list_subagents',
      'read_subagent',
      'launch_subagent',
      'stop_subagent',
    ])
  })
})
