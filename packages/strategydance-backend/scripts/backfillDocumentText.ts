import { parseArgs } from 'node:util'

import { getUnindexedDocuments, indexDocumentText } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import readKnowledgeDocumentContentText from '~domain/knowledge/readKnowledgeDocumentContentText'

/*
  Fills the plain text the Knowledge module's search reads, `Document.contentText`, of every
  document a release left without one, from its `content`, run by hand once the release that added
  it has deployed:

    bun run backfill:document-text --production   # the project, with Application Default Credentials
    DATA_CONNECT_EMULATOR_HOST=localhost:9399 bun run backfill:document-text   # the emulators

  It pages through the documents still unindexed, 100 at a time, so it can stop at any point and
  start again where it left off: what it indexed stays indexed. Each is written only at the
  revision it read, so a page's fold landing in between, which writes its own text or nulls it
  again, is never written over: that document comes round again in the next page, and one that
  keeps moving is left after three tries for the search to index when it next looks. No request
  ever carries this: the search indexes a few documents itself before it reads the index, which is
  enough once this has run.

  It refuses to touch the project unless told to with `--production`
*/
const { values } = parseArgs({ args: process.argv.slice(2), options: { production: { type: 'boolean' } } })

if (!process.env.DATA_CONNECT_EMULATOR_HOST && !values.production) {
  console.error(
    'DATA_CONNECT_EMULATOR_HOST is not set: pass --production to fill the project, or point this at the emulators',
  )
  process.exit(1)
}

// How many times a document whose revision moved under every write is tried before it is left
const MAX_ATTEMPTS = 3

const attempts = new Map<string, number>()
const skippedIds: string[] = []
let indexed = 0

for (;;) {
  const { data } = await getUnindexedDocuments(dataConnect, { skippedIds })

  if (data.documents.length === 0) break

  for (const document of data.documents) {
    const { data: written } = await indexDocumentText(dataConnect, {
      id: document.id,
      revision: document.revision,
      contentText: readKnowledgeDocumentContentText(document.content),
    })

    if (written.document_updateMany === 1) {
      indexed++

      continue
    }

    const tried = (attempts.get(document.id) ?? 0) + 1

    attempts.set(document.id, tried)

    if (tried >= MAX_ATTEMPTS) skippedIds.push(document.id)
  }

  console.log(`Indexed ${indexed} documents so far`)
}

console.log(
  `Indexed ${indexed} documents${skippedIds.length ? `, and left ${skippedIds.length} that kept changing` : ''}`,
)

process.exit(0)
