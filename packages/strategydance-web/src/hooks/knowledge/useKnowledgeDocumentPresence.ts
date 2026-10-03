import { useEffect, useRef, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'

import useKnowledgeDocumentPresences from '~hooks/knowledge/useKnowledgeDocumentPresences'

import createKnowledgeDocumentPresence, {
  type KnowledgeDocumentPresence,
  type KnowledgeDocumentPresent,
} from '~utils/knowledge/createKnowledgeDocumentPresence'
import createKnowledgeDocumentPresenceWrites from '~utils/knowledge/createKnowledgeDocumentPresenceWrites'
import getPresenceColor from '~utils/knowledge/getPresenceColor'

type Options = {
  organizationId: string
  documentId: string
  // The page's, which its presence row is keyed by
  sessionId: string
  // The editor's, which draws the others' carets. Null until it is made
  awareness: Awareness | null
  // False until the document is stored and its editor open
  isEnabled: boolean
  viewerId: string | null
  // Sends what is left of the tab's text, which leaving waits for
  flushText: () => Promise<boolean>
}

/*
  Who else has a document open, for its page's avatars, and their carets, which the bridge gives
  the editor's awareness. The page's tab says it is there while it is in view, with where its caret
  is, and leaves when it is hidden or the page goes, closing the tab included. The session is the
  page's, so a remount speaks for the same tab
*/
function useKnowledgeDocumentPresence({
  organizationId,
  documentId,
  sessionId,
  awareness,
  isEnabled,
  viewerId,
  flushText,
}: Options) {
  const [people, setPeople] = useState<KnowledgeDocumentPresent[]>([])
  // The bridge the live query's pushes go to, while the effect below keeps one
  const presenceRef = useRef<KnowledgeDocumentPresence | null>(null)
  const isActive = isEnabled && awareness !== null

  useEffect(() => {
    if (!isEnabled || !awareness) return

    const presence = createKnowledgeDocumentPresence({
      awareness,
      sessionId,
      viewerId,
      writes: createKnowledgeDocumentPresenceWrites(organizationId, documentId, sessionId),
      flushText,
      getColor: getPresenceColor,
    })

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') presence.show()
      else presence.hide()
    }

    function handlePageHide() {
      presence.hide()
    }

    presenceRef.current = presence
    presence.attach({ onPeople: setPeople })
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    // A page back from the back and forward cache is shown without a `visibilitychange`
    window.addEventListener('pageshow', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handleVisibilityChange)
      presence.detach()
      presenceRef.current = null
    }
  }, [awareness, isEnabled, organizationId, documentId, sessionId, viewerId, flushText])

  useKnowledgeDocumentPresences({
    organizationId,
    documentId,
    isEnabled: isActive,
    onNext: rows => presenceRef.current?.receive(rows),
  })

  return isActive ? people : []
}

export default useKnowledgeDocumentPresence
