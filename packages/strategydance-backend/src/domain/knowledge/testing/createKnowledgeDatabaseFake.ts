import { MAX_DOCUMENTS } from 'strategydance-core'

import type { AnyVariables, ModuleDatabaseFakeBase } from '~domain/modules/testing/createModuleDatabaseFakeBase'

/*
  The backend connector's Knowledge module operations, over tables kept in memory, added to a
  module database fake's base, which `createModuleDatabaseFake` builds with every module's, for the
  modules' tests, which mock `strategydance-database/backend` with it. Each operation mirrors the
  conditions of its namesake in the connector, in the same order, and throws the same messages, so a
  test reads as the behaviour it checks rather than as a script of answers. `check:knowledge-module`
  checks those conditions against the emulators, which is what keeps the two alike: change one with
  the other. A search matches words and patterns as near as a test needs, which that script checks
  against Postgres' own
*/

export type FakeDocument = {
  id: string
  organizationId: string
  title: string
  content: string
  contentText: string | null
  state: string | null
  aspects: string[]
  isAiReadable: boolean
  isAiWritable: boolean
  revision: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FakeDocumentUpdate = {
  documentId: string
  id: string
  payload: string
  createdAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function createKnowledgeDatabaseFake<Base extends ModuleDatabaseFakeBase>(base: Base) {
  const { stamp, id, isMember, membershipOf, matchesLike, insertResult, storeResult, checkKey } = base
  const documents = new Map<string, FakeDocument>()
  const updates: FakeDocumentUpdate[] = []

  // Declared here rather than read off the base, so a call narrows what follows it
  function refuse(message: string): never {
    throw new Error(message)
  }

  // A document written straight into its table, as a page would have stored it
  function insertDocument(fields: Partial<FakeDocument> & { organizationId: string }) {
    const time = stamp()
    const document: FakeDocument = {
      id: id(crypto.randomUUID()),
      title: '',
      content: '',
      contentText: '',
      state: null,
      aspects: [],
      isAiReadable: true,
      isAiWritable: true,
      revision: 0,
      deletedAt: null,
      createdAt: time,
      updatedAt: time,
      ...fields,
    }

    document.id = id(document.id)
    document.organizationId = id(document.organizationId)
    documents.set(document.id, document)

    return document
  }

  // The web's `PushDocumentUpdate`: a tab's edit, pending until somebody folds it
  function pushUpdate(documentId: string, payload: string) {
    const update = { documentId: id(documentId), id: id(crypto.randomUUID()), payload, createdAt: stamp() }

    updates.push(update)

    return update
  }

  // The web's `CompactDocument`, as a page from before `contentText` sends it: a fold of its own,
  // which moves the revision and leaves the plain text null
  function compactWithoutText(documentId: string, state: string, content: string) {
    const document = documents.get(id(documentId))

    if (!document) refuse('No document by that id')

    Object.assign(document, { state, content, contentText: null, revision: document.revision + 1, updatedAt: stamp() })
    updates.splice(0, updates.length, ...updates.filter(update => update.documentId !== document.id))
  }

  function pendingUpdates(documentId: string) {
    return updates
      .filter(update => update.documentId === documentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
  }

  // A document of the caller's organization agents may read, live, as every read filters it
  function isReadable(document: FakeDocument, variables: AnyVariables) {
    return (
      document.organizationId === id(variables.organizationId) && document.deletedAt === null && document.isAiReadable
    )
  }

  function hasAspects(document: FakeDocument, aspects: string[]) {
    return aspects.every(aspect => document.aspects.includes(aspect))
  }

  function byLatest(a: FakeDocument, b: FakeDocument) {
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1
  }

  // Postgres' `simple` configuration, near enough: lowercase words, split on anything else
  function words(text: string) {
    return text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
  }

  function searchRow(document: FakeDocument) {
    const { id: documentId, title, aspects, updatedAt, isAiWritable, contentText } = document

    return { id: documentId, title, aspects, updatedAt, isAiWritable, contentText }
  }

  // A document agents may change, as every write but a create and a restore matches it
  function writableDocument(variables: AnyVariables) {
    const document = documents.get(id(variables.id))

    return document && isReadable(document, variables) && document.isAiWritable ? document : null
  }

  function liveCount(organizationId: unknown) {
    return [...documents.values()].filter(
      document => document.organizationId === id(organizationId) && document.deletedAt === null,
    ).length
  }

  function pruneDeleted(organizationId?: unknown) {
    let deleted = 0

    for (const document of documents.values()) {
      const isOrganizations = organizationId === undefined || document.organizationId === id(organizationId)

      if (isOrganizations && document.deletedAt !== null && Date.parse(document.deletedAt) < Date.now() - DAY_MS) {
        documents.delete(document.id)
        updates.splice(0, updates.length, ...updates.filter(update => update.documentId !== document.id))
        deleted++
      }
    }

    return deleted
  }

  function checkTitle(title: unknown) {
    if (typeof title === 'string' && (title.length > 200 || /[\r\n]/.test(title))) {
      refuse("A document's title is at most 200 characters on one line")
    }
  }

  base.addOperations({
    GetDocumentAccessForAgent: variables => {
      const document = documents.get(id(variables.id))

      return {
        membership: membershipOf(variables),
        documents:
          document && document.organizationId === id(variables.organizationId)
            ? [
                {
                  isAiReadable: document.isAiReadable,
                  isAiWritable: document.isAiWritable,
                  deletedAt: document.deletedAt,
                },
              ]
            : [],
      }
    },

    SearchDocumentsForAgent: variables => {
      const terms = words(String(variables.query))

      return {
        documents_search: isMember(variables)
          ? [...documents.values()]
              .filter(document => isReadable(document, variables) && hasAspects(document, variables.aspects))
              .filter(document => {
                const held = new Set(words(`${document.title} ${document.contentText ?? ''}`))

                return terms.length > 0 && terms.every(term => held.has(term))
              })
              .slice(0, 20)
              .map(searchRow)
          : [],
      }
    },

    GetDocumentSearchCorpusForAgent: variables => ({
      documents: isMember(variables)
        ? [...documents.values()]
            .filter(document => isReadable(document, variables) && hasAspects(document, variables.aspects))
            .sort(byLatest)
            .slice(0, 100)
            .map(document => ({ id: document.id }))
        : [],
    }),

    SearchDocumentsBySubstringForAgent: variables => {
      const patterns = [0, 1, 2, 3, 4, 5, 6, 7].map(index => String(variables[`pattern${index}`]))
      const recentIds = new Set((variables.recentIds as string[]).map(id))

      return {
        documents: isMember(variables)
          ? [...documents.values()]
              .filter(document => isReadable(document, variables) && hasAspects(document, variables.aspects))
              // Each pattern in the title, or in the text of a recent document
              .filter(document =>
                patterns.every(
                  pattern =>
                    matchesLike(document.title, pattern)
                    || (recentIds.has(document.id)
                      && document.contentText !== null
                      && matchesLike(document.contentText, pattern)),
                ),
              )
              .slice(0, 20)
              .map(searchRow)
          : [],
      }
    },

    GetUnindexedDocumentsForAgent: variables => ({
      membership: membershipOf(variables),
      documents: isMember(variables)
        ? [...documents.values()]
            .filter(document => isReadable(document, variables) && document.contentText === null)
            .slice(0, 21)
            .map(({ id: documentId, content, revision }) => ({ id: documentId, content, revision }))
        : [],
    }),

    IndexDocumentTextForAgent: variables => {
      const document = documents.get(id(variables.id))
      const isIndexed =
        isMember(variables)
        && document !== undefined
        && document.organizationId === id(variables.organizationId)
        && document.revision === variables.revision
        && document.contentText === null

      if (isIndexed) document.contentText = String(variables.contentText)

      return { document_updateMany: isIndexed ? 1 : 0 }
    },

    ListDocumentsForAgent: variables => {
      const listed = isMember(variables)
        ? [...documents.values()].filter(
            document => isReadable(document, variables) && hasAspects(document, variables.aspects),
          )
        : []
      const row = ({ id: documentId, title, aspects, updatedAt, isAiWritable }: FakeDocument) => ({
        id: documentId,
        title,
        aspects,
        updatedAt,
        isAiWritable,
      })

      return {
        membership: membershipOf(variables),
        atCursor: listed
          .filter(document => document.updatedAt === variables.before)
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map(row),
        beforeCursor: listed
          .filter(document => document.updatedAt < String(variables.before))
          .sort(byLatest)
          .slice(0, 51)
          .map(row),
      }
    },

    GetDocumentForAgent: variables => {
      const document = documents.get(id(variables.id))

      if (!document || !isMember(variables) || !isReadable(document, variables)) return { documents: [] }

      return {
        documents: [
          {
            title: document.title,
            aspects: document.aspects,
            isAiWritable: document.isAiWritable,
            revision: document.revision,
            state: document.state,
            content: document.content,
            updatedAt: document.updatedAt,
            documentUpdates_on_document: pendingUpdates(document.id)
              .slice(0, 100)
              .map(update => ({ id: update.id, payload: update.payload })),
          },
        ],
      }
    },

    SeedDocumentStateForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')
      if (String(variables.state).length > 2000000) refuse("A document's state is at most 2000000 characters")

      const document = documents.get(id(variables.id))

      if (
        !document
        || !isReadable(document, variables)
        || document.state !== null
        || document.revision !== variables.revision
      ) {
        refuse('The document was seeded or changed elsewhere since it was read')
      }

      document.state = String(variables.state)
      document.revision++

      return { document_updateMany: 1 }
    },

    CreateDocumentForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      checkTitle(variables.title)

      if (variables.content.length > 200000 || variables.contentText.length > 200000) {
        refuse("A document's content is at most 200000 characters")
      }

      if (variables.state.length > 2000000) refuse("A document's state is at most 2000000 characters")
      if (!/\S/.test(variables.title) && variables.content === '') refuse('A document starts with a title or some text')

      if (new Set(variables.aspects).size !== variables.aspects.length) {
        refuse('A document is tagged with each aspect at most once')
      }

      insertResult(variables)

      if (liveCount(variables.organizationId) >= MAX_DOCUMENTS) refuse('An organization keeps at most 1000 documents')
      if (documents.has(id(variables.id))) refuse('violates SQL unique constraint: document_pkey (aborted)')

      storeResult(variables)
      insertDocument({
        id: String(variables.id),
        organizationId: String(variables.organizationId),
        title: String(variables.title),
        content: String(variables.content),
        contentText: String(variables.contentText),
        state: String(variables.state),
        aspects: [...variables.aspects],
      })

      return { document_insert: { id: id(variables.id) } }
    },

    FoldDocumentForAgent: variables => {
      insertResult(variables)

      const document = writableDocument(variables)

      if (!document || document.revision !== variables.revision) {
        refuse('The document was folded, deleted or closed to agents since it was read')
      }

      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      checkTitle(variables.title)

      if (variables.content.length > 200000 || variables.contentText.length > 200000) {
        refuse("A document's content is at most 200000 characters")
      }

      if (variables.state.length > 2000000) refuse("A document's state is at most 2000000 characters")

      // The title as committed, unless the fold writes one
      const title = typeof variables.title === 'string' ? variables.title : document.title

      if (variables.content === '' && !/\S/.test(title)) refuse('A document keeps a title or some text')

      const merged = new Set((variables.updateIds as string[]).map(id))

      if (variables.isWholeReplacement && pendingUpdates(document.id).some(update => !merged.has(update.id))) {
        refuse('The document was edited since it was read')
      }

      storeResult(variables)
      Object.assign(document, {
        state: String(variables.state),
        content: String(variables.content),
        contentText: String(variables.contentText),
        ...(typeof variables.title === 'string' && { title: variables.title }),
        revision: document.revision + 1,
        updatedAt: stamp(),
      })
      updates.splice(
        0,
        updates.length,
        ...updates.filter(update => update.documentId !== document.id || !merged.has(update.id)),
      )

      return { document_updateMany: 1, documentUpdate_deleteMany: merged.size }
    },

    RenameDocumentForAgent: variables => {
      insertResult(variables)

      const document = writableDocument(variables)

      if (!document) refuse('The document was deleted or closed to agents since it was read')
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      checkTitle(variables.title)

      if (!/\S/.test(variables.title) && document.content === '' && pendingUpdates(document.id).length === 0) {
        refuse('A document keeps a title or some text')
      }

      storeResult(variables)
      Object.assign(document, { title: String(variables.title), updatedAt: stamp() })

      return { document_updateMany: 1 }
    },

    SetDocumentAspectsForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)

      if (new Set(variables.aspects).size !== variables.aspects.length) {
        refuse('A document is tagged with each aspect at most once')
      }

      insertResult(variables)

      const document = writableDocument(variables)

      if (!document) refuse('The document was deleted or closed to agents since it was read')

      storeResult(variables)
      Object.assign(document, { aspects: [...variables.aspects], updatedAt: stamp() })

      return { document_updateMany: 1 }
    },

    DeleteDocumentForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)

      const document = writableDocument(variables)

      if (!document) refuse('The document was deleted or closed to agents since it was read')

      storeResult(variables)
      document.deletedAt = stamp()

      return { document_updateMany: 1, document_deleteMany: pruneDeleted(variables.organizationId) }
    },

    RestoreDocumentForAgent: variables => {
      if (!isMember(variables)) refuse('The caller is no longer a member of the organization')

      checkKey(variables)
      insertResult(variables)

      if (liveCount(variables.organizationId) >= MAX_DOCUMENTS) refuse('An organization keeps at most 1000 documents')

      const document = documents.get(id(variables.id))
      const isRestorable =
        document !== undefined
        && document.organizationId === id(variables.organizationId)
        && document.deletedAt !== null
        && Date.parse(document.deletedAt) > Date.now() - DAY_MS
        && document.isAiReadable
        && document.isAiWritable

      if (!isRestorable) refuse('The document is gone for good or closed to agents')

      storeResult(variables)
      document.deletedAt = null

      return { document_updateMany: 1 }
    },

    DeleteExpiredDocuments: () => ({ document_deleteMany: pruneDeleted() }),

    GetUnindexedDocuments: variables => {
      const skipped = new Set((variables.skippedIds as string[]).map(id))

      return {
        documents: [...documents.values()]
          .filter(document => document.contentText === null && !skipped.has(document.id))
          .slice(0, 100)
          .map(({ id: documentId, content, revision }) => ({ id: documentId, content, revision })),
      }
    },

    IndexDocumentText: variables => {
      const document = documents.get(id(variables.id))
      const isIndexed =
        document !== undefined && document.revision === variables.revision && document.contentText === null

      if (isIndexed) document.contentText = String(variables.contentText)

      return { document_updateMany: isIndexed ? 1 : 0 }
    },
  })

  base.onReset(() => {
    documents.clear()
    updates.length = 0
  })

  return Object.assign(base, { documents, updates, insertDocument, pushUpdate, compactWithoutText, pendingUpdates })
}

export type KnowledgeDatabaseFake = ReturnType<typeof createKnowledgeDatabaseFake<ModuleDatabaseFakeBase>>

export default createKnowledgeDatabaseFake
