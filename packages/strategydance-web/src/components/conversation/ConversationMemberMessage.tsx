import { Fragment } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ConversationMessageAttachment, KnowledgeDocumentSummary } from '~types'

import parseConversationMemberText from '~utils/conversation/parseConversationMemberText'

import ConversationAttachmentChip from '~components/conversation/ConversationAttachmentChip'
import ConversationAttachmentImage from '~components/conversation/ConversationAttachmentImage'
import ConversationDocumentLink from '~components/conversation/ConversationDocumentLink'

type Props = {
  conversationId: string
  text: string
  // The files it sent, in the order Claude reads them
  attachments: readonly ConversationMessageAttachment[]
  // The organization's documents by id, or null while they are not read
  documents: ReadonlyMap<string, KnowledgeDocumentSummary> | null
  // Small in a dock's window, as Strategy Dance's replies are there
  size?: 'sm' | 'md'
}

/*
  What the reader wrote: a grey bubble on the right, its line breaks kept, as plain text, but for
  the knowledge it mentions, drawn as Strategy Dance's replies draw a link to a document. Nothing
  else is read as Markdown, so what the reader typed stays as typed. The files it sent sit above
  it, images as thumbnails and any other file as a chip, and a message of files alone has no bubble
*/
function ConversationMemberMessage({ conversationId, text, attachments, documents, size = 'md' }: Props) {
  return (
    <div className="flex max-w-[85%] min-w-0 flex-col items-end gap-1.5 self-end">
      {attachments.length ? (
        <div className="flex max-w-full flex-wrap items-start justify-end gap-1.5">
          {attachments.map(attachment =>
            attachment.contentType.startsWith('image/') ? (
              <ConversationAttachmentImage
                key={attachment.id}
                conversationId={conversationId}
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
      {text ? (
        <div
          className={cn(
            'box-border max-w-full rounded-sm bg-neutral-100 px-3 py-2 leading-normal whitespace-pre-wrap text-foreground wrap-anywhere',
            size === 'sm' ? 'text-sm' : 'text-base',
          )}
        >
          {parseConversationMemberText(text).map((segment, index) => (
            <Fragment key={index}>
              {segment.kind === 'text' ? (
                segment.text
              ) : (
                <ConversationDocumentLink
                  href={segment.href}
                  documents={documents}
                >
                  {segment.label}
                </ConversationDocumentLink>
              )}
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default ConversationMemberMessage
