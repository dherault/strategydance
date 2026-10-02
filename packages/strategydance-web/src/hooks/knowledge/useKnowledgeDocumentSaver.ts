import { useEffect, useEffectEvent, useState } from 'react'

import type { KnowledgeDocumentFields, KnowledgeDocumentSaveStatus } from '~types'

import createKnowledgeDocumentSaver from '~utils/knowledge/createKnowledgeDocumentSaver'
import createKnowledgeDocumentWrites from '~utils/knowledge/createKnowledgeDocumentWrites'

type Options = {
  organizationId: string
  documentId: string
  // What the page opens with: the stored document's fields, or a draft's
  fields: KnowledgeDocumentFields
  // The stored revision, or null for a draft
  revision: number | null
  // The draft was stored, once
  onCreated: () => void
}

/*
  The saver a document's page writes through, where its saving stands, and when it last saved.

  It is made once, in a state initializer, bound to the organization the page opened in, so what
  is left to send when the page goes still reaches that organization whatever the sidebar
  switched to. The effect attaches it, and its cleanup detaches it, which sends what is left and
  deletes the document if the page emptied it. StrictMode's extra cycle detaches and attaches the
  same saver, which neither sends nor deletes anything.

  What is left also goes out when the tab is hidden, which is the last moment a phone or a closed
  laptop gives, and leaving the tab with something unsent asks first
*/
function useKnowledgeDocumentSaver({ organizationId, documentId, fields, revision, onCreated }: Options) {
  const [saver] = useState(() =>
    createKnowledgeDocumentSaver({
      documentId,
      fields,
      revision,
      writes: createKnowledgeDocumentWrites(organizationId, documentId),
    }),
  )
  const [status, setStatus] = useState<KnowledgeDocumentSaveStatus>(() => saver.getStatus())
  // When a send last went through whole, for the page to say it changed just now
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const handleCreated = useEffectEvent(onCreated)

  useEffect(() => {
    saver.attach({
      onStatus: setStatus,
      onCreated: () => handleCreated(),
      onSaved: () => setSavedAt(new Date().toISOString()),
    })

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') saver.flush()
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!saver.hasUnsaved()) return

      saver.flush()
      event.preventDefault()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      saver.detach()
    }
  }, [saver])

  return { saver, status, savedAt }
}

export default useKnowledgeDocumentSaver
