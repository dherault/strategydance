import type { PartialBlock } from '@blocknote/core'
import { _blocksToProsemirrorNode } from '@blocknote/core/yjs'
import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { RICH_TEXT_YJS_FRAGMENT, type RichTextBlock } from 'strategydance-design-system/lib/richText'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  type RichTextEditorBlock,
  getRichTextBlockTypes,
} from 'strategydance-design-system/lib/richTextEditorSchema'
import { initProseMirrorDoc, updateYFragment } from 'y-prosemirror'
import * as Y from 'yjs'

type ProseMirrorNode = ReturnType<typeof initProseMirrorDoc>['doc']

type ProseMirrorSchema = ProseMirrorNode['type']['schema']

type HeadlessRichTextEditor = ReturnType<typeof getHeadlessRichTextEditor>

/** An edit to a shared text, as the agent's tools make them, its blocks in the stored model */
export type RichTextYDocEdit =
  /** The top-level blocks from one id to another, both included, replaced by others */
  | { type: 'replaceBlocks'; fromId: string; toId: string; blocks: RichTextBlock[] }
  /** Blocks added after the last one */
  | { type: 'append'; blocks: RichTextBlock[] }
  /** A piece of text that occurs exactly once, replaced by another */
  | { type: 'replaceText'; find: string; replace: string }

export type UpdateRichTextYDocResult =
  | { outcome: 'updated' }
  /** The document holds no text yet, which a seed has to write first */
  | { outcome: 'notSeeded' }
  /** The document holds a block or a style the schema lacks, a newer editor's, or is not one group of blocks */
  | { outcome: 'unknownContent' }
  /** No top-level block has the id */
  | { outcome: 'blockNotFound'; id: string }
  /** Several top-level blocks have the id */
  | { outcome: 'blockNotUnique'; id: string }
  /** The range starts after it ends */
  | { outcome: 'invalidRange' }
  /** The text occurs nowhere, or is empty */
  | { outcome: 'textNotFound' }
  /** The text occurs more than once, overlapping occurrences included */
  | { outcome: 'textNotUnique'; count: number }

type Options = {
  // The blocks the editor writing in it writes, all four unless it says fewer
  blocks?: readonly RichTextEditorBlock[]
  // The origin of the one transaction the edit is written in
  origin?: unknown
}

// The next document, and the top-level blocks to delete from the shared text before writing it
type Plan = { next: ProseMirrorNode; removed?: { index: number; length: number } }

/*
  Applies an edit to a shared text in place, as a difference, the way an editor's own keystrokes
  are written, so that it merges with whatever somebody types meanwhile in another tab. A document
  rebuilt from the edited blocks would share no history with the stored one, and merging it would
  add the whole text a second time.

  It reads the document as y-prosemirror's binding does, then hands `updateYFragment` the next
  document built from the very nodes that read produced, with the read's metadata, so every block
  the edit leaves alone is found by identity and keeps its Yjs items, its id, and whatever
  relative position points into it. Blocks matched by equality alone, as a node rebuilt from
  BlockNote's blocks would be, can pair an untouched block that does not read back exactly, a
  cleared one say, with a new one, and delete it with what somebody typed in it.

  Replaced blocks are deleted before the new ones are written, so the new ones are fresh, and what
  somebody typed meanwhile in a replaced block goes with it. `updateYFragment` is marked private
  and unstable in y-prosemirror, which is pinned for it: this file's tests are what a newer
  version has to pass.

  Nothing is written when the edit is refused: the verdict comes from a copy, read first. Then the
  document itself is read and written in one transaction from the caller's origin, since even a
  read y-prosemirror can make sense of joins two texts the document wrote side by side
*/
function updateRichTextYDoc(
  doc: Y.Doc,
  edit: RichTextYDocEdit,
  { blocks = RICH_TEXT_EDITOR_BLOCKS, origin = null }: Options = {},
): UpdateRichTextYDocResult {
  const fragment = doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT)

  if (!fragment.length) return { outcome: 'notSeeded' }

  const editor = getHeadlessRichTextEditor(blocks)
  const copy = readCopy(doc, editor.pmSchema)

  if (!copy) return { outcome: 'unknownContent' }

  const verdict = planEdit(copy, edit, editor, blocks)

  if ('outcome' in verdict) return verdict

  // The document reads as its copy did, joined texts aside, so its plan is the copy's, on its own nodes
  let result: UpdateRichTextYDocResult = { outcome: 'updated' }

  doc.transact(() => {
    const { doc: root, meta } = initProseMirrorDoc(fragment, editor.pmSchema)
    const plan = planEdit(root, edit, editor, blocks)

    if ('outcome' in plan) {
      result = plan

      return
    }

    if (plan.removed) (fragment.get(0) as Y.XmlElement).delete(plan.removed.index, plan.removed.length)

    updateYFragment(doc, fragment, plan.next, meta)
  }, origin)

  return result
}

function planEdit(
  root: ProseMirrorNode,
  edit: RichTextYDocEdit,
  editor: HeadlessRichTextEditor,
  blocks: readonly RichTextEditorBlock[],
): Plan | Exclude<UpdateRichTextYDocResult, { outcome: 'updated' }> {
  const group = root.child(0)
  const children = readChildren(group)

  if (edit.type === 'replaceText') return planReplaceText(root, edit.find, edit.replace)

  const added = createNodes(editor, normalizeRichText(edit.blocks, { blockTypes: getRichTextBlockTypes(blocks) }))

  if (edit.type === 'append') return { next: withChildren(root, group, [...children, ...added]) }

  const from = findBlock(children, edit.fromId)

  if (typeof from !== 'number') return from

  const to = findBlock(children, edit.toId)

  if (typeof to !== 'number') return to
  if (from > to) return { outcome: 'invalidRange' }

  const next = [...children.slice(0, from), ...added, ...children.slice(to + 1)]

  // A group holds one block at least, so a document emptied of every block keeps an empty paragraph,
  // which `normalizeRichText` would drop
  return {
    next: withChildren(root, group, next.length ? next : createNodes(editor, [{ type: 'paragraph' }])),
    removed: { index: from, length: to - from + 1 },
  }
}

// The index of the one top-level block with the id
function findBlock(children: ProseMirrorNode[], id: string) {
  const indexes = children.flatMap((child, index) => (child.attrs.id === id ? [index] : []))

  if (!indexes.length) return { outcome: 'blockNotFound' as const, id }
  if (indexes.length > 1) return { outcome: 'blockNotUnique' as const, id }

  return indexes[0]
}

/*
  The one occurrence of `find`, in the text of any block, nested ones included, replaced by
  `replace` in the marks of the first character it replaces: a match right after a bold word does
  not turn bold, and one inside a link stays in it. A block's text counts a hard break as a line
  break, so its offsets are the block's own, and so does `replace`, whose line breaks become hard
  breaks as BlockNote writes them
*/
function planReplaceText(root: ProseMirrorNode, find: string, replace: string) {
  if (!find) return { outcome: 'textNotFound' as const }

  const matches: { path: number[]; offset: number }[] = []

  collectMatches(root, find, [], matches)

  if (!matches.length) return { outcome: 'textNotFound' as const }
  if (matches.length > 1) return { outcome: 'textNotUnique' as const, count: matches.length }

  const [{ path, offset }] = matches

  return { next: replaceAt(root, path, content => replaceInContent(content, offset, find.length, replace)) }
}

// Every occurrence of `find` in the inline content of a block under `node`, by the path to it
function collectMatches(
  node: ProseMirrorNode,
  find: string,
  path: number[],
  matches: { path: number[]; offset: number }[],
) {
  if (node.inlineContent) {
    const text = node.textBetween(0, node.content.size, undefined, '\n')

    for (let offset = text.indexOf(find); offset !== -1; offset = text.indexOf(find, offset + 1)) {
      matches.push({ path, offset })
    }

    return
  }

  node.forEach((child, _offset, index) => collectMatches(child, find, [...path, index], matches))
}

function replaceInContent(content: ProseMirrorNode, offset: number, length: number, replace: string) {
  const { schema } = content.type
  const marks = content.nodeAt(offset)?.marks ?? []
  const nodes = [
    ...readChildren(content.content.cut(0, offset)),
    ...createInline(schema, replace, marks),
    ...readChildren(content.content.cut(offset + length)),
  ]

  // Creating the block from the array joins neighbouring runs that carry the same marks
  return content.type.create(content.attrs, nodes, content.marks)
}

// Text with line breaks, as text nodes and the hard breaks between them
function createInline(schema: ProseMirrorSchema, text: string, marks: ProseMirrorNode['marks']) {
  return text
    .split('\n')
    .flatMap((line, index) => [
      ...(index ? [schema.nodes.hardBreak.create()] : []),
      ...(line ? [schema.text(line, marks)] : []),
    ])
}

// `node` with the descendant at `path` replaced, every node off that path kept as it is
function replaceAt(
  node: ProseMirrorNode,
  path: number[],
  replace: (node: ProseMirrorNode) => ProseMirrorNode,
): ProseMirrorNode {
  if (!path.length) return replace(node)

  const [index, ...rest] = path

  return node.copy(node.content.replaceChild(index, replaceAt(node.child(index), rest, replace)))
}

function withChildren(root: ProseMirrorNode, group: ProseMirrorNode, children: ProseMirrorNode[]) {
  return root.copy(root.content.replaceChild(0, group.type.create(group.attrs, children, group.marks)))
}

// New blocks as top-level nodes of the editor's schema, each with a fresh id
function createNodes(editor: HeadlessRichTextEditor, value: RichTextBlock[]) {
  return readChildren(_blocksToProsemirrorNode(editor, value as PartialBlock[]).child(0))
}

function readChildren(node: Pick<ProseMirrorNode, 'forEach'>) {
  const children: ProseMirrorNode[] = []

  node.forEach(child => children.push(child))

  return children
}

/*
  The shared text as y-prosemirror reads it, read from a copy, or null when that read changed the
  copy or built what the schema refuses. Its read deletes an element or a text it cannot build,
  such as a node or a style the schema lacks, a newer editor's say, and builds nodes without
  checking how they are arranged. The one other change a read makes, joining a text into the one
  before it when the reading document wrote both, cannot happen on a copy, whose client is new
*/
function readCopy(doc: Y.Doc, schema: ProseMirrorSchema) {
  const copy = new Y.Doc()
  let isChanged = false

  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  copy.on('update', () => {
    isChanged = true
  })

  const { doc: root } = initProseMirrorDoc(copy.getXmlFragment(RICH_TEXT_YJS_FRAGMENT), schema)

  try {
    root.check()
  } catch {
    return null
  }

  return isChanged ? null : root
}

export { updateRichTextYDoc }
