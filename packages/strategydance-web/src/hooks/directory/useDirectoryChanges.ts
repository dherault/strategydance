import { useQueryClient } from '@tanstack/react-query'
import { type DirectoryStatus, isDirectoryStatusInUse } from 'strategydance-core'
import {
  DirectoryStatus as DatabaseDirectoryStatus,
  type GetDirectoryNotesData,
  type GetDirectoryUsesData,
  setDirectoryNotes as setDirectoryNotesMutation,
  setDirectoryStatus as setDirectoryStatusMutation,
} from 'strategydance-database/web'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import { getRichTextContentTypes, RICH_TEXT_NOTE_BLOCKS } from 'strategydance-design-system/lib/richText'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

/*
  What a member changes of the current organization's directories, each change landing in the
  page's cache before it is sent: a directory's status, `isInUse` following it, and its notes, with
  their plain text, which the page searches. Each directory's status and notes queue their writes
  apart. They record no day of activity, which counts the Today data and the board alone
*/
function useDirectoryChanges() {
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const usesKey = ['GetDirectoryUses', organizationId]

  function setStatus(directoryId: string, status: DirectoryStatus | null) {
    const isInUse = isDirectoryStatusInUse(status)

    return writeOptimistically({
      queryClient,
      queryKeys: [usesKey],
      rowKey: `directory:${directoryId}:status`,
      apply: () =>
        queryClient.setQueryData<GetDirectoryUsesData>(
          usesKey,
          current =>
            current && {
              ...current,
              knowledgeUses: [
                ...current.knowledgeUses.filter(({ itemId }) => itemId !== directoryId),
                {
                  itemId: directoryId,
                  isInUse,
                  directoryStatus: status && DatabaseDirectoryStatus[status],
                  changedAt: new Date().toISOString(),
                },
              ],
            },
        ),
      write: () =>
        setDirectoryStatusMutation(dataConnect, {
          organizationId: organizationId!,
          directoryId,
          directoryStatus: status && DatabaseDirectoryStatus[status],
          isInUse,
        }),
    })
  }

  function setNotes(directoryId: string, content: string) {
    const notesKey = ['GetDirectoryNotes', organizationId, directoryId]
    const contentText = content
      ? getRichTextText(parseRichText(content, getRichTextContentTypes(RICH_TEXT_NOTE_BLOCKS)))
      : ''
    const updatedAt = new Date().toISOString()

    return writeOptimistically({
      queryClient,
      queryKeys: [notesKey, usesKey],
      rowKey: `directory:${directoryId}:notes`,
      apply: () => {
        queryClient.setQueryData<GetDirectoryNotesData>(notesKey, { knowledgeNotes: [{ content, updatedAt }] })
        queryClient.setQueryData<GetDirectoryUsesData>(
          usesKey,
          current =>
            current && {
              ...current,
              knowledgeNotes: [
                ...current.knowledgeNotes.filter(({ itemId }) => itemId !== directoryId),
                { itemId: directoryId, contentText, updatedAt },
              ],
            },
        )
      },
      write: () =>
        setDirectoryNotesMutation(dataConnect, {
          organizationId: organizationId!,
          directoryId,
          content,
          contentText,
        }),
    })
  }

  return { setStatus, setNotes }
}

export default useDirectoryChanges
