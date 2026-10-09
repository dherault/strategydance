import { RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import { initProseMirrorDoc } from 'y-prosemirror'
import * as Y from 'yjs'

type ProseMirrorNode = ReturnType<typeof initProseMirrorDoc>['doc']

type ProseMirrorSchema = ProseMirrorNode['type']['schema']

// How y-prosemirror names the attribute of a mark that may overlap itself, with a hash after it
const HASHED_MARK_NAME = /(.*)(--[a-zA-Z0-9+/=]{8})$/

/*
  The shared text as y-prosemirror reads it, read from a copy, with the copy it was read from, or
  null when that read changed the copy, built what the schema refuses, or left out what the schema
  does not declare. Its read deletes an element or a text it cannot build, such as a node or a
  style the schema lacks, a newer editor's say, builds nodes without checking how they are
  arranged, and drops an attribute of a node or a style that the schema does not declare, which
  `updateYFragment` would then remove from whatever it writes. The one other change a read makes,
  joining a text into the one before it when the reading document wrote both, cannot happen on a
  copy, whose client is new.

  The copy reads as the document does, so anything that reads it, BlockNote's `yDocToBlocks`
  included, reads what the document holds without deleting anything from it
*/
function readRichTextYDocCopy(doc: Y.Doc, schema: ProseMirrorSchema) {
  const copy = new Y.Doc()
  let isChanged = false

  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  copy.on('update', () => {
    isChanged = true
  })

  // A type y-prosemirror does not expect, such as a hook, throws rather than being deleted
  let root: ProseMirrorNode

  try {
    root = initProseMirrorDoc(copy.getXmlFragment(RICH_TEXT_YJS_FRAGMENT), schema).doc
    root.check()
  } catch {
    return null
  }

  if (isChanged || hasUndeclaredAttributes(copy.getXmlFragment(RICH_TEXT_YJS_FRAGMENT), schema)) return null

  return { copy, root }
}

// Whether an element or a style of a text read without error carries an attribute its schema does not declare
function hasUndeclaredAttributes(type: Y.XmlFragment | Y.XmlElement, schema: ProseMirrorSchema): boolean {
  return type.toArray().some(child => {
    if (child instanceof Y.XmlElement) {
      const declared = schema.nodes[child.nodeName].spec.attrs ?? {}

      return (
        Object.keys(child.getAttributes()).some(name => !Object.hasOwn(declared, name))
        || hasUndeclaredAttributes(child, schema)
      )
    }

    if (!(child instanceof Y.XmlText)) return true

    return child.toDelta().some((delta: { attributes?: Record<string, unknown> }) =>
      Object.entries(delta.attributes ?? {}).some(([name, value]) => {
        const declared = schema.marks[HASHED_MARK_NAME.exec(name)?.[1] ?? name].spec.attrs ?? {}

        return !!value && typeof value === 'object' && Object.keys(value).some(key => !Object.hasOwn(declared, key))
      }),
    )
  })
}

export { readRichTextYDocCopy }
