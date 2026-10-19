import type { KnowledgeDocumentBlock } from '~types'

// A document's text in Markdown, whole, its top-level blocks read as an agent reads them, one after the other
function toKnowledgeDocumentMarkdown(blocks: readonly KnowledgeDocumentBlock[]) {
  return blocks.map(({ markdown }) => markdown).join('\n\n')
}

export default toKnowledgeDocumentMarkdown
