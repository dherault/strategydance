import { useEffect, useState } from 'react'

import type { OrganizationDocument } from '~types'

import createId from '~utils/common/createId'
import { getDocumentSaverKey } from '~utils/document/createDocumentSaver'
import createDocumentSync, { type StoredDocumentText } from '~utils/document/createDocumentSync'
import createDocumentSyncWrites from '~utils/document/createDocumentSyncWrites'
import loadRichTextYjs, { getLoadedRichTextYjs } from '~utils/document/loadRichTextYjs'

type Options = {
  // The organization the page opened in, which it keeps when the sidebar switches to another
  organizationId: string
  documentId: string
  // The stored document as the page read it, or null for a draft
  organizationDocument: OrganizationDocument | null
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
function useDocumentSync({ organizationId, documentId, organizationDocument }: Options) {
  const [stored] = useState<StoredDocumentText | null>(() =>
    organizationDocument
      ? {
          state: organizationDocument.state ?? null,
          updates: organizationDocument.documentUpdates_on_document,
          content: organizationDocument.content,
          revision: organizationDocument.revision,
        }
      : null,
  )
  const [sync] = useState(() =>
    createDocumentSync({
      documentId,
      writes: createDocumentSyncWrites(organizationId, documentId),
      createUpdate: value => getLoadedRichTextYjs().createRichTextYUpdate(value),
      readContent: doc => {
        const { value, isEmpty } = getLoadedRichTextYjs().readRichTextYDoc(doc)

        return isEmpty ? '' : value
      },
      createId,
      after: [getDocumentSaverKey(documentId)],
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

export default useDocumentSync
