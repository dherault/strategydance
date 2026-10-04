import type { ComponentProps, ReactNode } from 'react'
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'strategydance-design-system/components/ui/Table'
import { RICH_TEXT_CLASSES } from 'strategydance-design-system/lib/richText'
import { cn } from 'strategydance-design-system/lib/utils'

type MarkdownLink = {
  /** The link's address, `doc:` and an id */
  href: string
  /** Its words, drawn */
  children: ReactNode
}

type Props = {
  /** Markdown, as the agent writes it */
  value: string
  /** `sm` is the dock's 14px, `md` the page's 16px */
  size?: 'sm' | 'md'
  /** Draws a link to a knowledge document, `doc:<id>`. Without it, such a link is its words */
  renderLink?: (link: MarkdownLink) => ReactNode
  className?: string
}

const sizeClassNames = {
  sm: 'text-sm/[1.6]',
  md: 'text-base/[1.6]',
}

// `~` alone is how an estimate is written, "~5 minutes", so only `~~` strikes
const remarkPlugins = [[remarkGfm, { singleTilde: false }], remarkBreaks] satisfies ComponentProps<
  typeof ReactMarkdown
>['remarkPlugins']

// What is drawn as itself, or through `components` below. Anything else gives way to what it holds
const allowedElements = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'a',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'img',
]

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'doc:'])

/*
  Draws the Markdown the agent writes, in the subset its replies keep to: paragraphs, bulleted and
  numbered lists, tables, bold, italic, strikethrough, links and line breaks.

  The text is the agent's, and the agent reads the web, so nothing in it is trusted. HTML is drawn
  as the text it is, never as markup. A link keeps its address only when it is a web or mail one,
  or a knowledge document's, `doc:<id>`, which `renderLink` draws, and is its words otherwise. An
  image is its alt text and is never loaded, since loading one would send its address, and
  whatever was written into it, out from the reader's browser.

  What falls outside the subset keeps its words: a heading is a bold paragraph, so a reply never
  enters the page's outline, a code block a paragraph that keeps its lines, and a quote or inline
  code their text. A single newline breaks the line, as it does where the agent's text is typed
  and read elsewhere, rather than running two lines into one
*/
function Markdown({ value, size = 'md', renderLink, className }: Props) {
  const components: Components = {
    ...staticComponents,
    a: ({ href, children }) => renderAnchor(href, children, renderLink),
  }

  return (
    <div
      className={cn(sizeClassNames[size], 'wrap-anywhere text-pretty text-foreground [&>:last-child]:mb-0', className)}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        allowedElements={allowedElements}
        unwrapDisallowed
        urlTransform={transformUrl}
        components={components}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

// The address as the URL parser writes it, when it is one a link may keep
function transformUrl(url: string) {
  try {
    const { href, protocol } = new URL(url)

    return SAFE_PROTOCOLS.has(protocol) ? href : null
  } catch {
    return null
  }
}

function renderAnchor(href: string | undefined, children: ReactNode, renderLink: Props['renderLink']) {
  if (!href) return children

  if (href.startsWith('doc:')) return renderLink ? renderLink({ href, children }) : children

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={RICH_TEXT_CLASSES.link}
    >
      {children}
    </a>
  )
}

function renderHeading({ children }: ComponentProps<'h1'>) {
  return (
    <p className="mb-2">
      <strong className="font-semibold text-secondary">{children}</strong>
    </p>
  )
}

// GFM's `:-:` and `--:`, which the cell carries as `align`
function readAlign(node: ExtraProps['node']) {
  const align = node?.properties.align

  return align === 'left' || align === 'center' || align === 'right' ? align : undefined
}

/*
  Each takes only what it draws, never the class names and styles GFM gives its elements. A list's
  markers are named, since preflight strips them, a bulleted one's by its depth: a disc, a circle,
  then a square for the third level and any below it, which a reply hardly reaches, where `RichText`
  starts the cycle again. A loose list is drawn as tight as any other
*/
const staticComponents: Components = {
  p: ({ children }) => <p className="mb-2">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-secondary">{children}</strong>,
  ul: ({ children }) => (
    <ul
      className={cn(
        'mb-2 list-disc pl-[18px] [&_ul]:list-[circle] [&_ul_ul]:list-[square]',
        '[&>li::marker]:text-neutral-400',
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ start, children }) => (
    <ol
      start={start}
      className="mb-2 list-decimal pl-5 [&>li::marker]:text-neutral-500 [&>li::marker]:tabular-nums"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="my-0.5 [&>:last-child]:mb-0">{children}</li>,
  table: ({ children }) => (
    <Table
      density="sm"
      containerClassName="mb-2"
    >
      {children}
    </Table>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ node, children }) => <TableHead align={readAlign(node)}>{children}</TableHead>,
  td: ({ node, children }) => <TableCell align={readAlign(node)}>{children}</TableCell>,
  h1: renderHeading,
  h2: renderHeading,
  h3: renderHeading,
  h4: renderHeading,
  h5: renderHeading,
  h6: renderHeading,
  // Its `code` is unwrapped, so what it holds is the block's text
  pre: ({ children }) => <p className="mb-2 whitespace-pre-wrap">{children}</p>,
  img: ({ alt }) => alt ?? null,
}

export { Markdown }
export type { MarkdownLink }
