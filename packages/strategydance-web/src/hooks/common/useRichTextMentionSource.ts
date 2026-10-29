import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { TaskStatus } from 'strategydance-database/web'
import type {
  RichTextMentionKind,
  RichTextMentionSource,
  RichTextMentionTarget,
} from 'strategydance-design-system/lib/richText'

import useOrganizationDocuments from '~hooks/document/useOrganizationDocuments'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'
import useTasks from '~hooks/task/useTasks'

type Options = {
  /** The document or the task being written, which is never suggested */
  self?: RichTextMentionTarget
  /** How a click opens a task, as a task's dialog opens another in its place: its page otherwise */
  openTask?: (taskId: string) => void
  /**
   * Whether a click may leave the page for what a mention names, true unless leaving would lose what
   * is written and not saved, where a click opens it in a new tab instead
   */
  canLeave?: boolean
}

/*
  Where a page's rich text draws its mentions of documents and tasks from: the current
  organization's documents and its board, kept live, so a mention draws the current title and one
  deleted is gone from them at once, and the addresses they open. Each list is read only once a
  mention or the menu asks for it, as a conversation's thread reads them for its links, and is null
  until it lands, or when it could not be read, when a mention draws the words it was made with.

  The documents come latest edited first, as the list reads them, and the tasks in the board's
  order, those done last, so the menu suggests what is current first
*/
function useRichTextMentionSource({ self, openTask, canLeave = true }: Options = {}): RichTextMentionSource {
  const [requested, setRequested] = useState<ReadonlySet<RichTextMentionKind>>(() => new Set())
  const organizationSlug = useCurrentOrganizationSlug()
  const router = useRouter()
  const navigate = useNavigate()
  const documents = useOrganizationDocuments({ isEnabled: requested.has('document') })
  const tasks = useTasks({ isEnabled: requested.has('task') })

  const isDocumentsRead = requested.has('document') && !documents.initialLoading && !documents.hasFailed
  const isTasksRead = requested.has('task') && !tasks.initialLoading && !tasks.hasFailed

  function getHref({ kind, id }: RichTextMentionTarget) {
    const location =
      kind === 'document'
        ? router.buildLocation({
            to: '/$organizationSlug/knowledge/$documentId',
            params: { organizationSlug, documentId: id },
          })
        : router.buildLocation({ to: '/$organizationSlug/tasks/$taskId', params: { organizationSlug, taskId: id } })

    return location.href
  }

  function open({ kind, id }: RichTextMentionTarget) {
    if (kind === 'document') {
      navigate({ to: '/$organizationSlug/knowledge/$documentId', params: { organizationSlug, documentId: id } })
    } else if (openTask) {
      openTask(id)
    } else {
      navigate({ to: '/$organizationSlug/tasks/$taskId', params: { organizationSlug, taskId: id } })
    }
  }

  return {
    documents: isDocumentsRead
      ? new Map(documents.data.map(document => [toCanonicalId(document.id), document.title]))
      : null,
    tasks: isTasksRead
      ? new Map(
          [
            ...tasks.data.filter(task => task.status !== TaskStatus.DONE),
            ...tasks.data.filter(task => task.status === TaskStatus.DONE),
          ].map(task => [toCanonicalId(task.id), task.name]),
        )
      : null,
    request: kind => setRequested(current => (current.has(kind) ? current : new Set(current).add(kind))),
    getHref,
    open: canLeave ? open : undefined,
    self,
  }
}

// An id as Data Connect writes one, which a mention holds
function toCanonicalId(id: string) {
  return id.replaceAll('-', '').toLowerCase()
}

export default useRichTextMentionSource
