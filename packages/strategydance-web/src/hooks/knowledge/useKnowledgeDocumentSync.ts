import { useEffect, useState } from 'react'

import type { KnowledgeDocument } from '~types'

import createId from '~utils/common/createId'
import { getKnowledgeDocumentSaverKey } from '~utils/knowledge/createKnowledgeDocumentSaver'
import createKnowledgeDocumentSync, {
  type StoredKnowledgeDocumentText,
} from '~utils/knowledge/createKnowledgeDocumentSync'
import createKnowledgeDocumentSyncWrites from '~utils/knowledge/createKnowledgeDocumentSyncWrites'
import loadRichTextYjs, { getLoadedRichTextYjs } from '~utils/knowledge/loadRichTextYjs'

type Options = {
  // The organization the page opened in, which it keeps when the sidebar switches to another
  organizationId: string
  documentId: string
  // The stored document as the page read it, or null for a draft
  knowledgeDocument: KnowledgeDocument | null
}

/*
  The sync that keeps a document's text in step with everybody else's, and whether it is ready for
  the editor to open on: the stored text merged, or seeded when the document has no snapshot yet,
  or a draft's empty one. It waits for the design system's conversions between stored rich text
  and Yjs, which load as the editor does, and `hasFailed` says when that or the seed failed.

  Made once, in a state initializer, from the document as the page first read it, bound to the
  organization the page opened in. Started from an effect, which StrictMode runs twice and which
  starts it once
*/
function useKnowledgeDocumentSync({ organizationId, documentId, knowledgeDocument }: Options) {
  const [stored] = useState<StoredKnowledgeDocumentText | null>(() =>
    knowledgeDocument
      ? {
          state: knowledgeDocument.state ?? null,
          updates: knowledgeDocument.documentUpdates_on_document,
          content: knowledgeDocument.content,
          revision: knowledgeDocument.revision,
        }
      : null,
  )
  const [sync] = useState(() =>
    createKnowledgeDocumentSync({
      documentId,
      writes: createKnowledgeDocumentSyncWrites(organizationId, documentId),
      createUpdate: value => getLoadedRichTextYjs().createRichTextYUpdate(value),
      readContent: doc => {
        const { value, isEmpty } = getLoadedRichTextYjs().readRichTextYDoc(doc)

        return isEmpty ? '' : value
      },
      createId,
      after: [getKnowledgeDocumentSaverKey(documentId)],
    }),
  )
  const [readiness, setReadiness] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let isMounted = true

    loadRichTextYjs()
      .then(() => sync.start(stored))
      .then(() => {
        if (isMounted) setReadiness('ready')
      })
      .catch(error => {
        console.error('The document could not be opened', error)

        if (isMounted) setReadiness('failed')
      })

    return () => {
      isMounted = false
    }
  }, [sync, stored])

  return { sync, isReady: readiness === 'ready', hasFailed: readiness === 'failed' }
}

export default useKnowledgeDocumentSync
