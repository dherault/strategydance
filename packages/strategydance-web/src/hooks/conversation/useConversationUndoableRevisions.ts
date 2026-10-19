import { useQuery } from '@tanstack/react-query'
import type { UndoableDocumentRevisionsData } from 'strategydance-core'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

type UndoableDocumentRevision = UndoableDocumentRevisionsData['revisions'][number]

const NONE: ReadonlyMap<string, UndoableDocumentRevision> = new Map()

// How long a read stands before the window's focus reads it again, as somebody writes in a document elsewhere
const STALE_TIME = 30 * 1000

/*
  The edits a conversation's agent made to documents that an Undo can still take back, nobody
  having written in their document since, by the key of the call that made each, Claude's id for
  it, which the row's body holds. The backend reads each document's text to say so, so it is read
  only once the thread holds an edit, again when it holds another and as the window takes the
  focus. Empty until it is read, and when it could not be, when no row offers Undo
*/
function useConversationUndoableRevisions(conversationId: string, editCount: number) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  const { data } = useQuery({
    queryKey: ['UndoableDocumentRevisions', organizationId, conversationId, editCount, viewerId],
    queryFn: async () => {
      const { revisions } = await requestApi<UndoableDocumentRevisionsData>({
        method: 'GET',
        path: `/organizations/${organizationId}/knowledge/revisions/undoable/${conversationId}`,
      })

      return new Map(revisions.map(revision => [revision.callKey, revision]))
    },
    enabled: Boolean(organizationId && viewerId && editCount),
    staleTime: STALE_TIME,
    retryOnMount: false,
  })

  return data ?? NONE
}

export default useConversationUndoableRevisions
