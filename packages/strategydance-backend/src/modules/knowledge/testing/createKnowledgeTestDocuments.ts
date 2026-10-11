import { RICH_TEXT_YJS_FRAGMENT } from 'strategydance-design-system/lib/richText'
import * as Y from 'yjs'

import createKnowledgeDocumentText from '~domain/knowledge/createKnowledgeDocumentText'
import readKnowledgeDocumentText from '~domain/knowledge/readKnowledgeDocumentText'
import type { FakeDocument } from '~domain/knowledge/testing/createKnowledgeDatabaseFake'
import type { ModuleDatabaseFake } from '~domain/modules/testing/createModuleDatabaseFake'

/*
  Documents as the Knowledge module's tests meet them, in one organization of the database fake:
  stored as a page stores one, or as a page stored one before the editor was shared, typed into by a
  tab, which pushes its edit as a pending update, and read back as the editor would read them now
*/
function createKnowledgeTestDocuments(fake: ModuleDatabaseFake, organizationId: string) {
  // The first snapshot, content and plain text of a text written in Markdown
  function measure(markdown: string) {
    const text = createKnowledgeDocumentText(markdown)

    if (text.outcome !== 'measured') throw new Error(`The text is too long: ${text.outcome}`)

    return text
  }

  // A document stored as a page stores one, its text shared from its first save
  function store(markdown: string, fields: Partial<FakeDocument> = {}) {
    const { state, content, contentText } = measure(markdown)

    return fake.insertDocument({ organizationId, title: 'Plan', state, content, contentText, ...fields })
  }

  // A document a page stored before the editor was shared: its content, and no snapshot yet
  function storeUnshared(markdown: string, fields: Partial<FakeDocument> = {}) {
    const { content, contentText } = measure(markdown)

    return fake.insertDocument({ organizationId, title: 'Plan', state: null, content, contentText, ...fields })
  }

  // A tab's copy of a document, as it opened it from its snapshot and the updates pending since
  function open(documentId: string) {
    const document = fake.documents.get(documentId)

    if (!document?.state) throw new Error('The document has no snapshot')

    const doc = new Y.Doc()

    Y.applyUpdate(doc, Buffer.from(document.state, 'base64'))

    for (const update of fake.pendingUpdates(documentId)) Y.applyUpdate(doc, Buffer.from(update.payload, 'base64'))

    return doc
  }

  // A tab typing into a top-level block, its edit pushed as a pending update, as the page pushes one
  function type(documentId: string, blockIndex: number, offset: number, text: string) {
    const doc = open(documentId)
    const before = Y.encodeStateVector(doc)
    const group = doc.getXmlFragment(RICH_TEXT_YJS_FRAGMENT).get(0) as Y.XmlElement
    const container = group.get(blockIndex) as Y.XmlElement

    ;((container.get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(offset, text)

    return fake.pushUpdate(documentId, Buffer.from(Y.encodeStateAsUpdate(doc, before)).toString('base64'))
  }

  // A document's text as the editor reads it now, its snapshot with every pending update merged
  function read(documentId: string) {
    const document = fake.documents.get(documentId)

    if (!document?.state) throw new Error('The document has no snapshot')

    const read = readKnowledgeDocumentText({ state: document.state, updates: fake.pendingUpdates(documentId) })

    if (read.outcome !== 'read') throw new Error(`The document cannot be read: ${read.outcome}`)

    return read.blocks
  }

  return { measure, store, storeUnshared, type, read }
}

export default createKnowledgeTestDocuments
