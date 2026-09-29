type SerializedNode = Record<string, unknown>

// Deep enough for any list indented by hand, as the design system's `RichText` reads
const MAX_DEPTH = 32

function isNode(value: unknown): value is SerializedNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function childrenOf(node: SerializedNode) {
  return Array.isArray(node.children) ? node.children.filter(isNode) : []
}

// A node's words, with a line break read as a space
function readText(node: SerializedNode, depth = 0): string {
  if (depth > MAX_DEPTH) return ''
  if (node.type === 'text' || node.type === 'tab') return typeof node.text === 'string' ? node.text : ''
  if (node.type === 'linebreak') return ' '

  return childrenOf(node)
    .map(child => readText(child, depth + 1))
    .join('')
}

/*
  What a card quotes of a log entry, from the editor state it is stored as: the words of its first
  paragraph or heading that has any, else all of its words, and the words of its first quote, if
  it has one. Whitespace is folded, since a card writes them on one line or a few. A value that
  does not parse says nothing
*/
function getRichTextSummary(value: string) {
  let root: SerializedNode | null = null

  try {
    const parsed: unknown = JSON.parse(value)

    if (isNode(parsed) && isNode(parsed.root)) root = parsed.root
  } catch {
    root = null
  }

  if (!root) return { text: '', quote: null }

  const blocks = childrenOf(root)
  const fold = (text: string) => text.replace(/\s+/g, ' ').trim()
  const firstText = blocks
    .filter(block => block.type === 'paragraph' || block.type === 'heading')
    .map(block => fold(readText(block)))
    .find(Boolean)
  const quoteBlock = blocks.find(block => block.type === 'quote')
  const quote = quoteBlock ? fold(readText(quoteBlock)) : ''

  return { text: firstText ?? fold(readText(root)), quote: quote || null }
}

export default getRichTextSummary
