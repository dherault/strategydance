import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import createModuleAddresses from '~modules/createModuleAddresses'
import knowledgeModule from '~modules/knowledge/knowledgeModule'
import KNOWLEDGE_TOOLS from '~modules/knowledge/knowledgeTools'

// What the server tells an agent before it calls anything: what Strategy Dance is, what the
// documents are and how they are written, and how to write to them safely
const INSTRUCTIONS = `Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server is the organization's knowledge: the documents its team writes together, such as plans, notes and decisions, each tagged with the aspects of the company it is about, among STRATEGY, PEOPLE, FINANCES, PRODUCT, ENGINEERING, DESIGN, MARKETING, SALES and LEGAL. You act as one member of the organization.

Documents are written in Markdown: headings to the third level, paragraphs, quotes, bulleted, numbered and check lists, bold, italic, <u>underline</u>, strikethrough, links, code blocks and tables. A single newline breaks the line. Anything else is kept as text, and a picture as a link to it.

The team shares every document, and members may be editing one while you do: read a document before you change it, prefer edits that name the blocks or the text they change over replacing the whole content, and expect your edit to merge with what they type. The team decides which documents agents may read or change: when a call is refused, tell the member rather than work around it.

Every write tool takes an idempotency key in the call's _meta, under "${MODULE_IDEMPOTENCY_KEY_META}": send a new one with each write, and the same one when you send the same write again after losing its answer. A write sent again without a key can be applied twice.`

// The Knowledge module's MCP server, built for one caller, whom every tool acts as
function createKnowledgeServer(caller: ModuleCaller) {
  const server = new McpServer(
    { name: 'strategydance-knowledge', title: knowledgeModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )
  const context = { caller, toAddress: createModuleAddresses(caller, 'knowledge') }

  for (const register of KNOWLEDGE_TOOLS) register(server, context)

  return server
}

export default createKnowledgeServer
