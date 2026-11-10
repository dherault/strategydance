import type { ModuleName } from 'strategydance-core'

import type { ModuleInstructions } from '~types'

// What opens a mention, on the Documents module's server alone or beside the modules listed
function toMentionOpener(listed: readonly ModuleName[] | null) {
  if (!listed) return "read_document or the task board's read_task opens"

  return listed.includes('tasks') ? 'read_document or read_task opens' : "read_document opens when it is a document's"
}

// What the Documents module tells an agent: what the documents are, how they are written, and how
// to write to them safely
const DOCUMENTS_INSTRUCTIONS: ModuleInstructions = {
  label: 'Documents',
  holds:
    "holds the organization's documents: what its team writes together, such as plans, notes and decisions, each tagged with the aspects of the company it is about, among STRATEGY, PEOPLE, FINANCES, PRODUCT, ENGINEERING, DESIGN, MARKETING, SALES and LEGAL.",
  paragraphs: listed => [
    `Documents are written in Markdown: headings to the third level, paragraphs, quotes, bulleted, numbered and check lists, bold, italic, <u>underline</u>, strikethrough, \`inline code\`, links, code blocks and tables. Inline code takes no other style and stays out of links. A single newline breaks the line. Anything else is kept as text, and a picture as a link to it. A link to doc:<id> or task:<id>, as in [Pricing](doc:<id>), is a mention of the document or the task with that id, which ${toMentionOpener(listed)}; write one the same way to mention one. A link to conversation:<id> is a mention of one of the team's conversations with Strategy Dance, which no tool opens: keep it as written.`,
    'The team shares every document, and members may be editing one while you do: read a document before you change it, prefer edits that name the blocks or the text they change over replacing the whole content, and expect your edit to merge with what they type. The team decides which documents agents may read or change: when a call is refused, tell the member rather than work around it.',
  ],
}

export default DOCUMENTS_INSTRUCTIONS
