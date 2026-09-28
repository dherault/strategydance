import type { ReactNode } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'
import {
  RICH_TEXT_CLASS_NAME,
  RICH_TEXT_FORMAT_BOLD,
  RICH_TEXT_FORMAT_ITALIC,
  RICH_TEXT_FORMAT_STRIKETHROUGH,
  RICH_TEXT_FORMAT_UNDERLINE,
  RICH_TEXT_THEME,
} from 'strategydance-design-system/lib/richText'

// Deeper than any list anybody indents by hand, and shallow enough that a hostile value nesting
// thousands of levels cannot exhaust the stack
const MAX_DEPTH = 32

type Props = {
  /** A Lexical editor state, serialized as `RichTextEditor` hands it over */
  value: string
  className?: string
}

type SerializedNode = Record<string, unknown>

/*
  Draws what `RichTextEditor` wrote, without Lexical.

  The value is somebody else's, since a feed shows everybody's posts, and it arrives as JSON a
  client wrote. So nothing in it is trusted: it is walked node by node and only an allowlist
  becomes elements, paragraphs, one heading level, quotes, the two kinds of list, line breaks and
  text with four formats. Every other key is ignored, `style` above all, which Lexical's own
  `TextNode` would apply as `cssText`. An element this does not know is unwrapped, so its text
  still reads, and anything else is dropped. Text is text: React escapes it.

  It never instantiates an editor, which keeps a feed of many posts cheap. A value that does not
  parse draws nothing
*/
function RichText({ value, className }: Props) {
  const root = parseRichText(value)

  if (!root) return null

  return (
    <div className={cn(RICH_TEXT_CLASS_NAME, className)}>
      {renderChildren(root, 0)}
    </div>
  )
}

function parseRichText(value: string): SerializedNode | null {
  try {
    const parsed: unknown = JSON.parse(value)

    if (!isNode(parsed) || !isNode(parsed.root) || parsed.root.type !== 'root') throw new Error('No root node')

    return parsed.root
  }
  catch (error) {
    console.error('Could not read a rich text value', error)

    return null
  }
}

function isNode(value: unknown): value is SerializedNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function renderChildren(node: SerializedNode, depth: number): ReactNode[] {
  if (depth >= MAX_DEPTH || !Array.isArray(node.children)) return []

  return node.children.map((child: unknown, index) => (isNode(child) ? renderNode(child, depth + 1, index) : null))
}

function renderNode(node: SerializedNode, depth: number, key: number): ReactNode {
  switch (node.type) {
    case 'paragraph': {
      const children = renderChildren(node, depth)

      return (
        <p
          key={key}
          className={RICH_TEXT_THEME.paragraph}
        >
          {/* An empty paragraph is a blank line, as the editor draws it */}
          {children.length ? children : <br />}
        </p>
      )
    }
    case 'heading':
      return (
        <h2
          key={key}
          className={RICH_TEXT_THEME.heading.h2}
        >
          {renderChildren(node, depth)}
        </h2>
      )
    case 'quote':
      return (
        <blockquote
          key={key}
          className={RICH_TEXT_THEME.quote}
        >
          {renderChildren(node, depth)}
        </blockquote>
      )
    case 'list':
      return node.listType === 'number'
        ? (
            <ol
              key={key}
              className={RICH_TEXT_THEME.list.ol}
            >
              {renderChildren(node, depth)}
            </ol>
          )
        : (
            <ul
              key={key}
              className={RICH_TEXT_THEME.list.ul}
            >
              {renderChildren(node, depth)}
            </ul>
          )
    case 'listitem':
      return (
        <li
          key={key}
          className={isNestedListItem(node) ? RICH_TEXT_THEME.list.nested.listitem : RICH_TEXT_THEME.list.listitem}
        >
          {renderChildren(node, depth)}
        </li>
      )
    case 'linebreak':
      return <br key={key} />
    case 'text':
    case 'tab':
      return renderText(node, key)
    default:
      // An element from a newer editor, say: its text still reads, without its wrapper
      return Array.isArray(node.children) ? renderChildren(node, depth) : null
  }
}

// Lexical nests a list inside the item it hangs from
function isNestedListItem(node: SerializedNode) {
  return Array.isArray(node.children) && node.children.some(child => isNode(child) && child.type === 'list')
}

function renderText(node: SerializedNode, key: number): ReactNode {
  if (typeof node.text !== 'string' || !node.text) return null

  const format = typeof node.format === 'number' ? node.format : 0
  const isUnderline = (format & RICH_TEXT_FORMAT_UNDERLINE) !== 0
  const isStrikethrough = (format & RICH_TEXT_FORMAT_STRIKETHROUGH) !== 0
  const textClassName = cn(
    (format & RICH_TEXT_FORMAT_BOLD) !== 0 && RICH_TEXT_THEME.text.bold,
    (format & RICH_TEXT_FORMAT_ITALIC) !== 0 && RICH_TEXT_THEME.text.italic,
    isUnderline && isStrikethrough
      ? RICH_TEXT_THEME.text.underlineStrikethrough
      : cn(isUnderline && RICH_TEXT_THEME.text.underline, isStrikethrough && RICH_TEXT_THEME.text.strikethrough),
  )

  if (!textClassName) return node.text

  return (
    <span
      key={key}
      className={textClassName}
    >
      {node.text}
    </span>
  )
}

export { RichText }
