import { useIntl } from 'react-intl'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import type { RichTextMentionSource } from 'strategydance-design-system/lib/richText'
import { RICH_TEXT_EDITOR_BLOCKS } from 'strategydance-design-system/lib/richText'

import useDocumentRevisionContent from '~hooks/knowledge/useDocumentRevisionContent'

import Spinner from '~components/common/Spinner'

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  organizationId: string
  revisionId: string
  mentions: RichTextMentionSource
}

/*
  The text a revision of a document keeps, the text as it stood before that change, drawn as the
  document's page draws its text without an editor, its mentions from the organization's lists.
  Read when the entry opens it, once
*/
function KnowledgeDocumentRevisionPreview({ organizationId, revisionId, mentions }: Props) {
  const { formatMessage } = useIntl()
  const { data: content, isPending, isError } = useDocumentRevisionContent({ organizationId, revisionId })

  if (isPending) return <Spinner className="mx-auto my-4" />

  if (isError || content === null) {
    return <p className="text-sm text-muted-foreground">{formatMessage(knowledgeMessages.revisionTextError)}</p>
  }

  if (!content) {
    return <p className="text-sm text-muted-foreground">{formatMessage(knowledgeMessages.revisionTextEmpty)}</p>
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
      <RichText
        value={content}
        blocks={RICH_TEXT_EDITOR_BLOCKS}
        mentions={mentions}
        labels={{
          mentionUntitled: formatMessage(knowledgeMessages.untitled),
          mentionDocumentGone: formatMessage(knowledgeMessages.editorMentionDocumentGone),
          mentionTaskGone: formatMessage(knowledgeMessages.editorMentionTaskGone),
        }}
        className="text-sm"
      />
    </div>
  )
}

export default KnowledgeDocumentRevisionPreview
