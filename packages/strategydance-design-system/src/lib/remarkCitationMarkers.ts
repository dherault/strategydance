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

  - in a text node whose source is its value, which an escape or an entity breaks, the text is
    split at the offset and the marker goes between
  - in bold, italic or struck text the same, one level in, or after it
  - in a link or inline code, after it, since a marker inside a link would break it
  - between blocks, at the end of the last phrasing before the offset

  A marker whose offset falls before any phrasing is dropped
*/
function remarkCitationMarkers(markers: MarkdownCitationMarker[]) {
  return (tree: MarkdownNode) => {
    const containers = collectContainers(tree)
    const offsets = [...new Set(markers.map(({ offset }) => offset))]

    // From the last, so a text split for a later offset leaves the offsets an earlier one reads
    for (const offset of offsets.toSorted((a, b) => b - a)) {
      const container =
        containers.find(node => start(node) < offset && offset <= end(node))
        ?? containers.findLast(node => end(node) <= offset)
      const nodes = markers.filter(marker => marker.offset === offset).map(createMarker)

      if (container?.children) place(container.children, offset, nodes)
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
function place(children: MarkdownNode[], offset: number, nodes: MarkdownNode[]) {
  const index = children.findIndex(child => start(child) < offset && offset <= end(child))
  const child = children[index]

  if (!child) {
    const before = children.findLastIndex(node => end(node) <= offset)

    children.splice(before + 1, 0, ...nodes)

    return
  }

  if (child.type === 'text' && typeof child.value === 'string' && child.value.length === end(child) - start(child)) {
    const cut = offset - start(child)

    children.splice(
      index,
      1,
      ...[
        createText(child.value.slice(0, cut), start(child), offset),
        ...nodes,
        createText(child.value.slice(cut), offset, end(child)),
      ].filter(node => node.type !== 'text' || node.value),
    )

    return
  }

  if (!CLOSED_NODES.has(child.type) && child.children?.length) {
    place(child.children, offset, nodes)

    return
  }

  children.splice(index + 1, 0, ...nodes)
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
