import { Fragment } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import type { KnowledgeDocumentSummary } from '~types'

import parseConversationMemberText from '~utils/conversation/parseConversationMemberText'

import ConversationDocumentLink from '~components/conversation/ConversationDocumentLink'

type Props = {
  text: string
  // The organization's documents by id, or null while they are not read
  documents: ReadonlyMap<string, KnowledgeDocumentSummary> | null
  // Small in a dock's window, as Strategy Dance's replies are there
  size?: 'sm' | 'md'
}

/*
  What the reader wrote: a grey bubble on the right, its line breaks kept, as plain text, but for
  the knowledge it mentions, drawn as Strategy Dance's replies draw a link to a document. Nothing
  else is read as Markdown, so what the reader typed stays as typed
*/
function ConversationMemberMessage({ text, documents, size = 'md' }: Props) {
  return (
    <div className="flex max-w-[85%] min-w-0 flex-col items-end gap-1.5 self-end">
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
    </div>
  )
}

export default ConversationMemberMessage
