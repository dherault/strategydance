import { McpServer } from '@modelcontextprotocol/server'

import type { ModuleCaller } from '~types'

import { MODULE_IDEMPOTENCY_KEY_META } from '~constants'

import createModuleAddresses from '~modules/createModuleAddresses'
import documentsModule from '~modules/documents/documentsModule'
import DOCUMENTS_TOOLS from '~modules/documents/documentsTools'

// What the server tells an agent before it calls anything: what Strategy Dance is, what the
// documents are and how they are written, and how to write to them safely
const INSTRUCTIONS = `Strategy Dance accompanies a company's team as it builds, sells and runs the company. This server holds the organization's documents: what its team writes together, such as plans, notes and decisions, each tagged with the aspects of the company it is about, among STRATEGY, PEOPLE, FINANCES, PRODUCT, ENGINEERING, DESIGN, MARKETING, SALES and LEGAL. You act as one member of the organization.

Documents are written in Markdown: headings to the third level, paragraphs, quotes, bulleted, numbered and check lists, bold, italic, <u>underline</u>, strikethrough, \`inline code\`, links, code blocks and tables. Inline code takes no other style and stays out of links. A single newline breaks the line. Anything else is kept as text, and a picture as a link to it. A link to doc:<id> or task:<id>, as in [Pricing](doc:<id>), is a mention of the document or the task with that id, which read_document or the task board's read_task opens; write one the same way to mention one.

The team shares every document, and members may be editing one while you do: read a document before you change it, prefer edits that name the blocks or the text they change over replacing the whole content, and expect your edit to merge with what they type. The team decides which documents agents may read or change: when a call is refused, tell the member rather than work around it.

Every write tool takes an idempotency key in the call's _meta, under "${MODULE_IDEMPOTENCY_KEY_META}": send a new one with each write, and the same one when you send the same write again after losing its answer. A write sent again without a key can be applied twice.`

// The Documents module's MCP server, built for one caller, whom every tool acts as
function createDocumentsServer(caller: ModuleCaller) {
  const server = new McpServer(
    { name: 'strategydance-documents', title: documentsModule.title, version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  )
  const context = { caller, toAddress: createModuleAddresses(caller, 'knowledge') }

  for (const register of DOCUMENTS_TOOLS) register(server, context)

  return server
}

export default createDocumentsServer
