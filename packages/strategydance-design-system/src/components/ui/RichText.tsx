import { CheckIcon } from 'lucide-react'
import { type CSSProperties, Fragment, type ReactNode } from 'react'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { parseVideoEmbedUrl } from 'strategydance-design-system/lib/parseVideoEmbedUrl'
import {
  RICH_TEXT_CLASS_NAME,
  RICH_TEXT_CLASSES,
  RICH_TEXT_POST_BLOCKS,
  type RichTextBlock,
  type RichTextEditorBlock,
  type RichTextHeadingLevel,
  type RichTextImageBlock,
  type RichTextInline,
  type RichTextLinkPreviewBlock,
  type RichTextRun,
  type RichTextTableContent,
  type RichTextTextBlock,
  type RichTextVideoEmbedBlock,
  getRichTextBlockTypes,
} from 'strategydance-design-system/lib/richText'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  /** BlockNote's blocks, serialized as `RichTextEditor` hands them over */
  value: string
  /**
   * The blocks it draws besides paragraphs, a post's unless it says more: those of the editor that
   * wrote the value. Any other block holding text reads as a paragraph
   */
  blocks?: readonly RichTextEditorBlock[]
  className?: string
}

/*
  Draws what `RichTextEditor` wrote, without BlockNote.

  The value is somebody else's, since a feed shows everybody's posts, and it arrives as JSON a
  client wrote. So it is read through `parseRichText`, which keeps the blocks `blocks` names, four
  styles and links to web and mail addresses, and drops every other key, colors and alignment
  above all. Those become elements here and nothing else does. Text is text: React escapes it.
  A post draws a post's blocks only, whatever its JSON holds, since a feed and a public page show
  it, and a document passes the blocks its editor writes.

  BlockNote stores a list as its items, one block each, so the items of one kind that follow each
  other are drawn as one list, and what is nested under an item is drawn inside it. A link opens
  in a new tab and passes on nothing of the page.

  It never instantiates an editor, which keeps a feed of many posts cheap. A value it cannot read,
  an old Lexical one included, draws nothing
*/
function RichText({ value, blocks: blockTypes = RICH_TEXT_POST_BLOCKS, className }: Props) {
  const blocks = parseRichText(value, { blockTypes: getRichTextBlockTypes(blockTypes) })

  if (!blocks.length) return null

  return <div className={cn(RICH_TEXT_CLASS_NAME, className)}>{renderBlocks(blocks, 0)}</div>
}

function isListItem(block: RichTextBlock): block is RichTextTextBlock {
  return block.type === 'bulletListItem' || block.type === 'numberedListItem' || block.type === 'checkListItem'
}

// The blocks in drawing order, the list items of one kind that follow each other as one group
function groupBlocks(blocks: RichTextBlock[]) {
  return blocks.reduce<RichTextBlock[][]>((groups, block) => {
    const group = groups.at(-1)

    if (group && isListItem(block) && group[0].type === block.type) group.push(block)
    else groups.push([block])

    return groups
  }, [])
}

// `listDepth` is how many lists the blocks sit in, which picks a bulleted list's marker
function renderBlocks(blocks: RichTextBlock[], listDepth: number): ReactNode[] {
  return groupBlocks(blocks).map((group, index) =>
    isListItem(group[0])
      ? renderList(group as RichTextTextBlock[], listDepth, index)
      : renderBlock(group[0], listDepth, index),
  )
}

// A heading at its level's tag, as the editor writes it
function renderHeading(level: RichTextHeadingLevel, content: ReactNode) {
  const className = RICH_TEXT_CLASSES.headings[level]

  if (level === 1) return <h1 className={className}>{content}</h1>
  if (level === 3) return <h3 className={className}>{content}</h3>

  return <h2 className={className}>{content}</h2>
}

function renderBlock(block: RichTextBlock, listDepth: number, key: number) {
  const content =
    block.type === 'table' || block.type === 'image' || block.type === 'videoEmbed' || block.type === 'linkPreview'
      ? null
      : renderContent(block)
  const element =
    block.type === 'codeBlock' ? (
      <pre className={RICH_TEXT_CLASSES.code}>
        <code data-language={block.props?.language ?? 'text'}>{block.content?.[0].text}</code>
      </pre>
    ) : block.type === 'table' ? (
      renderTable(block.content)
    ) : block.type === 'image' ? (
      renderImage(block)
    ) : block.type === 'videoEmbed' ? (
      renderVideoEmbed(block)
    ) : block.type === 'linkPreview' ? (
      renderLinkPreview(block)
    ) : block.type === 'heading' ? (
      renderHeading(block.props?.level ?? 2, content)
    ) : block.type === 'quote' ? (
      <blockquote className={RICH_TEXT_CLASSES.quote}>{content}</blockquote>
    ) : (
      <p className={RICH_TEXT_CLASSES.paragraph}>{content}</p>
    )

  return (
    <Fragment key={key}>
      {element}
      {block.children ? (
        <div className={cn(RICH_TEXT_CLASSES.nested, 'mb-2')}>{renderBlocks(block.children, listDepth)}</div>
      ) : null}
    </Fragment>
  )
}

function renderList(items: RichTextTextBlock[], listDepth: number, key: number) {
  const [first] = items

  if (first.type === 'checkListItem') {
    return (
      <ul
        key={key}
        className={RICH_TEXT_CLASSES.checkList}
      >
        {items.map((item, index) => renderCheckItem(item, listDepth, index))}
      </ul>
    )
  }

  const listItems = items.map((item, index) => (
    <li
      key={index}
      className={RICH_TEXT_CLASSES.listItem}
    >
      {renderContent(item)}
      {item.children ? renderBlocks(item.children, listDepth + 1) : null}
    </li>
  ))

  if (first.type === 'numberedListItem') {
    const start = first.props?.start ?? 1

    return (
      <ol
        key={key}
        start={first.props?.start}
        // The count before its first item, for a stylesheet that numbers the items itself, as a card does
        style={{ '--rich-text-list-reset': start - 1 } as CSSProperties}
        className={RICH_TEXT_CLASSES.numberedList}
      >
        {listItems}
      </ol>
    )
  }

  const markers = RICH_TEXT_CLASSES.bulletMarkers

  return (
    <ul
      key={key}
      className={cn(RICH_TEXT_CLASSES.bulletedList, markers[listDepth % markers.length])}
    >
      {listItems}
    </ul>
  )
}

/*
  A check item, its box drawn for the eye and a native checkbox, visually hidden, saying for
  assistive technology whether it is ticked. Both sit in a label with its text, which names it
*/
function renderCheckItem(item: RichTextTextBlock, listDepth: number, key: number) {
  const isChecked = item.props?.checked === true

  return (
    <li
      key={key}
      data-checked={isChecked}
      className={RICH_TEXT_CLASSES.listItem}
    >
      <label className={RICH_TEXT_CLASSES.checkLabel}>
        <input
          type="checkbox"
          checked={isChecked}
          disabled
          readOnly
          className="sr-only"
        />
        <span
          aria-hidden="true"
          data-check-box
          className={cn(RICH_TEXT_CLASSES.checkBox, isChecked && RICH_TEXT_CLASSES.checkBoxChecked)}
        >
          {isChecked ? <CheckIcon /> : null}
        </span>
        <span className={cn('min-w-0', isChecked && RICH_TEXT_CLASSES.checkedText)}>{renderContent(item)}</span>
      </label>
      {item.children ? (
        <div className={RICH_TEXT_CLASSES.nested}>{renderBlocks(item.children, listDepth + 1)}</div>
      ) : null}
    </li>
  )
}

/*
  A table, its first row a header row and its first column a header column when it says so, and
  its columns as wide as the editor resized them, or as their text from the editor's least width
*/
function renderTable({ headerRows, headerCols, columnWidths, rows }: RichTextTableContent) {
  const classes = RICH_TEXT_CLASSES.table
  const [first, ...rest] = rows
  const header = headerRows ? first : null
  const body = headerRows ? rest : rows

  function renderCell(cell: RichTextInline[], column: number, isHeaderRow: boolean) {
    const className = cn(classes.cell, !columnWidths?.[column] && classes.unsizedCell)
    const content = cell.map(renderInline)

    if (isHeaderRow || (headerCols && column === 0)) {
      return (
        <th
          key={column}
          scope={isHeaderRow ? 'col' : 'row'}
          className={cn(className, classes.header)}
        >
          {content}
        </th>
      )
    }

    return (
      <td
        key={column}
        className={className}
      >
        {content}
      </td>
    )
  }

  return (
    <div className={classes.container}>
      <table className={classes.table}>
        {columnWidths ? (
          <colgroup>
            {columnWidths.map((width, column) => (
              <col
                key={column}
                style={width ? { width } : undefined}
              />
            ))}
          </colgroup>
        ) : null}
        {header ? (
          <thead>
            <tr>{header.cells.map((cell, column) => renderCell(cell, column, true))}</tr>
          </thead>
        ) : null}
        <tbody>
          {body.map((row, index) => (
            <tr key={index}>{row.cells.map((cell, column) => renderCell(cell, column, false))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/*
  A picture at its own width up to the text's, or at the width it was resized to, with its caption.
  It is loaded only once it nears the screen, and tells the site it comes from nothing of the page
*/
function renderImage({ props }: RichTextImageBlock) {
  if (!props?.url) return null

  const classes = RICH_TEXT_CLASSES.image

  return (
    <figure className={classes.figure}>
      <img
        src={props.url}
        alt={props.name ?? ''}
        width={props.previewWidth}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={classes.image}
      />
      {props.caption ? <figcaption className={classes.caption}>{props.caption}</figcaption> : null}
    </figure>
  )
}

/*
  A video in its provider's player, as the editor draws it: built from the video's address, loaded
  once it nears the screen, telling the provider which site it is on and nothing more
*/
function renderVideoEmbed({ props }: RichTextVideoEmbedBlock) {
  const embed = parseVideoEmbedUrl(props?.url)

  if (!embed) return null

  return (
    <div className={RICH_TEXT_CLASSES.videoEmbed}>
      <iframe
        src={embed.src}
        title={embed.providerName}
        loading="lazy"
        allow="fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  )
}

/*
  A card linking to a web page, as the editor draws it: what the page said of itself, its site, and
  its picture, loaded from wherever the page names it and telling it nothing of this one. The page
  opens in a new tab and learns nothing of this one either
*/
function renderLinkPreview({ props }: RichTextLinkPreviewBlock) {
  if (!props?.url) return null

  const classes = RICH_TEXT_CLASSES.linkPreview
  const host = new URL(props.url).hostname.replace(/^www\./, '')

  return (
    <a
      href={props.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={classes.card}
    >
      <span className={classes.text}>
        <span className={classes.title}>{props.title || host}</span>
        {props.description ? <span className={classes.description}>{props.description}</span> : null}
        <span className={classes.site}>{props.siteName ? `${props.siteName} · ${host}` : host}</span>
      </span>
      {props.imageUrl ? (
        <span className={classes.media}>
          <img
            src={props.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={classes.image}
          />
        </span>
      ) : null}
    </a>
  )
}

// A block's text, or a line break holding its line when it has none, as the editor draws it
function renderContent(
  block: Exclude<RichTextBlock, { type: 'table' | 'image' | 'videoEmbed' | 'linkPreview' }>,
): ReactNode {
  if (!block.content) return <br />

  return block.content.map(renderInline)
}

function renderInline(item: RichTextInline, key: number): ReactNode {
  if (item.type === 'text') return renderRun(item, key)

  return (
    <a
      key={key}
      href={item.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={RICH_TEXT_CLASSES.link}
    >
      {item.content.map(renderRun)}
    </a>
  )
}

function renderRun(run: RichTextRun, key: number): ReactNode {
  const { bold, italic, underline, strike } = run.styles ?? {}
  const { text: textClasses } = RICH_TEXT_CLASSES
  const className = cn(
    bold && textClasses.bold,
    italic && textClasses.italic,
    underline && strike
      ? textClasses.underlineStrikethrough
      : cn(underline && textClasses.underline, strike && textClasses.strikethrough),
  )
  const text = renderLines(run.text)

  if (!className) return <Fragment key={key}>{text}</Fragment>

  return (
    <span
      key={key}
      className={className}
    >
      {text}
    </span>
  )
}

// A line broken inside a block, with Shift+Enter, is a newline in its text
function renderLines(text: string): ReactNode {
  if (!text.includes('\n')) return text

  return text.split('\n').map((line, index) => (
    <Fragment key={index}>
      {index ? <br /> : null}
      {line}
    </Fragment>
  ))
}

export { RichText }
