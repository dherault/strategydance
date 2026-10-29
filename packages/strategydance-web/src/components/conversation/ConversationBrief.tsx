import { useIntl } from 'react-intl'

import type { DocumentSummary, Task } from '~types'

import useConversationBriefAttachments from '~hooks/conversation/useConversationBriefAttachments'

import ConversationAgentMessage from '~components/conversation/ConversationAgentMessage'
import ConversationAttachmentChip from '~components/conversation/ConversationAttachmentChip'
import ConversationAttachmentImage from '~components/conversation/ConversationAttachmentImage'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The conversation that launched the subagent, whose files the brief hands over
  parentId: string | null
  text: string
  // The ids of the parent's files it hands over, in the order the subagent reads them
  attachmentIds: readonly string[]
  // The organization's documents by id, which its links to documents draw, or null while not read
  documents: ReadonlyMap<string, DocumentSummary> | null
  // The organization's board by task id, which its links to tasks draw, or null while not read
  tasks: ReadonlyMap<string, Task> | null
  // Small in a dock's window, which is narrow
  size?: 'sm' | 'md'
}

/*
  What a subagent was asked to do, at the top of its thread: the brief Strategy Dance wrote it, in a
  bordered block that says so, drawn in the Markdown its replies are drawn in, since Strategy Dance
  wrote it, with the files it was handed above the words, images as thumbnails and any other file as
  a chip, as a member's message draws its own. They are the parent's files, read and served under
  the parent, and a file that can no longer be read is left out
*/
function ConversationBrief({ parentId, text, attachmentIds, documents, tasks, size = 'md' }: Props) {
  const { formatMessage } = useIntl()
  const { data: attachments } = useConversationBriefAttachments(parentId, attachmentIds)

  return (
    <section
      aria-label={formatMessage(conversationMessages.briefLabel)}
      className="flex min-w-0 flex-col gap-2.5 rounded-xs border border-border bg-neutral-50 p-3"
    >
      <p className="m-0 font-sans text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(conversationMessages.briefLabel)}
      </p>
      {parentId && attachments.length ? (
        <div className="flex max-w-full flex-wrap items-start gap-1.5">
          {attachments.map(attachment =>
            attachment.contentType.startsWith('image/') ? (
              <ConversationAttachmentImage
                key={attachment.id}
                conversationId={parentId}
                attachment={attachment}
              />
            ) : (
              <ConversationAttachmentChip
                key={attachment.id}
                attachment={attachment}
              />
            ),
          )}
        </div>
      ) : null}
      <ConversationAgentMessage
        text={text}
        documents={documents}
        tasks={tasks}
        size={size}
      />
    </section>
  )
}

export default ConversationBrief
