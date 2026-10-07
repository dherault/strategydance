// A Markdown syntax tree node, as much of it as placing a marker reads
type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
  position?: {
    start: { offset?: number }
    end: { offset?: number }
  }
  data?: Record<string, unknown>
}

// Where a citation's marker goes, by its offset in the Markdown text, and the key it is drawn by
export type MarkdownCitationMarker = {
  offset: number
  key: string
}

// The element a marker becomes, which `Markdown` draws through `renderCitation`
export const CITATION_MARKER_ELEMENT = 'citation-marker'

// The nodes whose text holds phrasing a marker goes among
const PHRASING_CONTAINERS = new Set(['paragraph', 'heading', 'tableCell'])

// Inline nodes a marker never goes inside, since their text is an address or code
const CLOSED_NODES = new Set(['link', 'linkReference', 'inlineCode', 'image', 'imageReference'])

/*
  A remark plugin placing a marker at each offset of the Markdown text a citation's span ends at,
  as an element of its own, `citation-marker`, carrying the citation's key, which agent text cannot
  forge since its HTML is never parsed. The markers of one offset go together, in the order given.
  It runs before any other transform, on the tree as parsed, whose nodes still carry their offsets:

  - in a text node, the text is split at the offset and the marker goes between, the offset read
    through the escapes, character references and stripped spaces that make a node's text shorter
    than its source
  - in bold, italic or struck text the same, one level in, or after it
  - in a link or inline code, after it, since a marker inside a link would break it
  - between blocks, at the end of the last phrasing before the offset

  A marker whose offset falls before any phrasing is dropped
*/
function remarkCitationMarkers(markers: MarkdownCitationMarker[]) {
  return (tree: MarkdownNode, file: { toString(): string }) => {
    const source = String(file)
    const containers = collectContainers(tree)
    const offsets = [...new Set(markers.map(({ offset }) => offset))]

    // From the last, so a text split for a later offset leaves the offsets an earlier one reads
    for (const offset of offsets.toSorted((a, b) => b - a)) {
      const container =
        containers.find(node => start(node) < offset && offset <= end(node))
        ?? containers.findLast(node => end(node) <= offset)
      const nodes = markers.filter(marker => marker.offset === offset).map(createMarker)

      if (container?.children) place(source, container.children, offset, nodes)
    }
  }
}

function collectContainers(node: MarkdownNode, found: MarkdownNode[] = []) {
  if (PHRASING_CONTAINERS.has(node.type) && node.position) found.push(node)

  for (const child of node.children ?? []) collectContainers(child, found)

  return found
}

// Places an offset's markers among a container's children, or among the children of the one it
// falls in
function place(source: string, children: MarkdownNode[], offset: number, nodes: MarkdownNode[]) {
  const index = children.findIndex(child => start(child) < offset && offset <= end(child))
  const child = children[index]

  if (!child) {
    const before = children.findLastIndex(node => end(node) <= offset)

    children.splice(before + 1, 0, ...nodes)

    return
  }

  const value = child.type === 'text' ? child.value : undefined
  const cut =
    value === undefined ? null : readValueOffset(source.slice(start(child), end(child)), value, offset - start(child))

  if (value !== undefined && cut !== null) {
    children.splice(
      index,
      1,
      ...[
        createText(value.slice(0, cut), start(child), offset),
        ...nodes,
        createText(value.slice(cut), offset, end(child)),
      ].filter(node => node.type !== 'text' || node.value),
    )

    return
  }

  if (!CLOSED_NODES.has(child.type) && child.children?.length) {
    place(source, child.children, offset, nodes)

    return
  }

  children.splice(index + 1, 0, ...nodes)
}

// A character reference, `&amp;` or `&#38;`, which a text node's value holds decoded
const CHARACTER_REFERENCE = /^&(?:#\d{1,7}|#[Xx][\dA-Fa-f]{1,6}|[A-Za-z][\dA-Za-z]{1,31});/

/*
  Where an offset into a text node's source falls in its value, reading both together: a backslash
  escape is two characters of source for one of value, a character reference the value holds
  decoded several for one or two, and the spaces a line's start or end loses are source alone. Null
  when the two part ways otherwise, and the marker goes after the node
*/
function readValueOffset(source: string, value: string, offset: number) {
  let sourceIndex = 0
  let valueIndex = 0

  while (sourceIndex < offset) {
    const reference = CHARACTER_REFERENCE.exec(source.slice(sourceIndex))?.[0]

    if (source[sourceIndex] === '\\' && source[sourceIndex + 1] === value[valueIndex]) {
      sourceIndex += 2
      valueIndex++
    } else if (reference && value.slice(valueIndex, valueIndex + reference.length) !== reference) {
      sourceIndex += reference.length
      valueIndex += readDecodedLength(reference, source[sourceIndex], value, valueIndex)
    } else if (source[sourceIndex] === value[valueIndex]) {
      sourceIndex++
      valueIndex++
    } else if (source[sourceIndex] === ' ' || source[sourceIndex] === '\t') {
      sourceIndex++
    } else {
      return null
    }
  }

  return Math.min(valueIndex, value.length)
}

/*
  How many code units a character reference decodes to: a numeric one exactly, two past U+FFFF and
  one for what CommonMark replaces with U+FFFD; a named one, most of which are one and a few two, by
  the source character after it, and at the source's end the rest of the value
*/
function readDecodedLength(reference: string, nextSource: string | undefined, value: string, valueIndex: number) {
  const numeric = /^&#(?:[Xx]([\dA-Fa-f]+)|(\d+));$/.exec(reference)

  if (numeric) {
    const codePoint = numeric[1] ? Number.parseInt(numeric[1], 16) : Number(numeric[2])

    return codePoint > 0xffff && codePoint <= 0x10ffff ? 2 : 1
  }

  if (nextSource === undefined) return value.length - valueIndex

  return value[valueIndex + 1] === nextSource ? 1 : 2
}

// An empty emphasis renamed, which mdast's conversion to HTML makes the marker's element
function createMarker({ key }: MarkdownCitationMarker): MarkdownNode {
  return {
    type: 'emphasis',
    children: [],
    data: { hName: CITATION_MARKER_ELEMENT, hProperties: { dataCitation: key } },
  }
}

function createText(value: string, from: number, to: number): MarkdownNode {
  return { type: 'text', value, position: { start: { offset: from }, end: { offset: to } } }
}

function start(node: MarkdownNode) {
  return node.position?.start.offset ?? Number.POSITIVE_INFINITY
}

function end(node: MarkdownNode) {
  return node.position?.end.offset ?? Number.NEGATIVE_INFINITY
}

export default remarkCitationMarkers
