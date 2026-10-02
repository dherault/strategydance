import { useBlocker } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useState } from 'react'

import type { KnowledgeDocumentFields, KnowledgeDocumentSaveStatus, KnowledgeDocumentSyncStatus } from '~types'

import createKnowledgeDocumentSaver from '~utils/knowledge/createKnowledgeDocumentSaver'
import type { KnowledgeDocumentSync } from '~utils/knowledge/createKnowledgeDocumentSync'
import createKnowledgeDocumentWrites from '~utils/knowledge/createKnowledgeDocumentWrites'

type Options = {
  organizationId: string
  documentId: string
  // What the page opens with: the stored document's fields, or a draft's
  fields: KnowledgeDocumentFields
  // False for a draft
  isStored: boolean
  // The document's text, which the saver creates a draft with and leaves alone after
  sync: KnowledgeDocumentSync
  // The draft was stored, once
  onCreated: () => void
  // Somebody else changed fields the page had no change of its own to, which it now shows
  onRemoteChange: (fields: Partial<KnowledgeDocumentFields>) => void
}

/*
  The saver a document's page writes its title, aspects and lock through, its sync, which pushes
  its text, where the saving of each stands, and when the document last saved.

  The saver is made once, in a state initializer, bound to the organization the page opened in, so
  what is left to send when the page goes still reaches that organization whatever the sidebar
  switched to. The effect attaches both, and its cleanup detaches both, which sends what is left,
  folds the text's pending updates, and deletes the document if the page emptied it. StrictMode's
  extra cycle detaches and attaches the same two, which delete nothing.

  What is left also goes out when the tab is hidden, which is the last moment a phone or a closed
  laptop gives, with the text's pending updates folded, and leaving the tab with something unsent
  asks first. A page that is going away, closed or reloaded, sends nothing of its text here, a
  fold least of all: a write cut off with the page leaves the Data Connect emulator's database
  stuck in its transaction. What is left to push went with the `beforeunload` prompt, while the
  page was still there, and the next tab to see the pending updates folds them. `pagehide` comes before the `visibilitychange`
  of a page going away, and `pageshow` takes back one kept in the back and forward cache.

  Leaving the page for another in the app waits for what is left to go out, since a send that
  fails once the page is gone has nobody left to tell. When something still cannot be saved,
  failed or too long, the navigation is held and `leave` says so, for the page to ask whether to
  go anyway. A navigation within the document, as a stored draft losing `isNew`, is never held
*/
function useKnowledgeDocumentSaver({
  organizationId,
  documentId,
  fields,
  isStored,
  sync,
  onCreated,
  onRemoteChange,
}: Options) {
  const [saver] = useState(() =>
    createKnowledgeDocumentSaver({
      documentId,
      fields,
      isStored,
      writes: createKnowledgeDocumentWrites(organizationId, documentId),
      text: {
        encodeForCreate: () => sync.encodeForCreate(),
        markCreated: () => sync.markCreated(),
        isChangedHere: () => sync.isChangedHere(),
      },
    }),
  )
  const [status, setStatus] = useState<KnowledgeDocumentSaveStatus>(() => saver.getStatus())
  const [syncStatus, setSyncStatus] = useState<KnowledgeDocumentSyncStatus>(() => sync.getStatus())
  // When a send last went through whole, for the page to say it changed just now
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const handleCreated = useEffectEvent(onCreated)
  const handleRemoteChange = useEffectEvent(onRemoteChange)

  const leave = useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (next.pathname === current.pathname || !(saver.hasUnsaved() || sync.hasUnsaved())) return false

      await Promise.all([saver.flush(), sync.flush()])

      return saver.hasUnsaved() || sync.hasUnsaved()
    },
    // The tab's own warning is the effect's below, which also sends what is left
    enableBeforeUnload: false,
    withResolver: true,
  })

  useEffect(() => {
    function markSaved() {
      setSavedAt(new Date().toISOString())
    }

    saver.attach({
      onStatus: setStatus,
      onCreated: () => handleCreated(),
      onSaved: markSaved,
      onRemoteChange: changed => handleRemoteChange(changed),
    })
    sync.attach({ onStatus: setSyncStatus, onSaved: markSaved })

    let isPageGoing = false

    function handlePageHide() {
      isPageGoing = true
    }

    function handlePageShow() {
      isPageGoing = false
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'hidden') return

      saver.flush()

      if (!isPageGoing) sync.flushAndCompact()
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!saver.hasUnsaved() && !sync.hasUnsaved()) return

      saver.flush()
      sync.flush()
      event.preventDefault()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // The text's last push and fold go before the saver deletes a document the page emptied
      saver.detach(sync.detach())
    }
  }, [saver, sync])

  return { saver, status, syncStatus, savedAt, leave }
}

export default useKnowledgeDocumentSaver
