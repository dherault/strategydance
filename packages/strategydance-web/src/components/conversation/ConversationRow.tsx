import { Trash2Icon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { ConversationSummary } from '~types'

import formatConversationPreview from '~utils/conversation/formatConversationPreview'

import CompanyAspectIcons from '~components/company/CompanyAspectIcons'
import ConversationUpdatedAt from '~components/conversation/ConversationUpdatedAt'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversation: ConversationSummary
  now: number
  onDelete: (conversation: ConversationSummary) => void
}

/*
  One conversation of the list: its title, with a badge when a question waits for the reader, a
  line of its last entry under it, its aspects, when it last changed, and Delete, which asks twice
*/
function ConversationRow({ conversation, now, onDelete }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl

  const preview = formatConversationPreview(intl, conversation)

  return (
    <TableRow>
      {/* The column takes what the others leave, and its lines are cut short to fit it */}
      <TableCell className="w-full max-w-0">
        {/* On a phone the badge goes under the title rather than leave it a letter or two */}
        <div className="flex min-w-0 items-center gap-x-2 gap-y-1 overflow-hidden max-sm:flex-wrap">
          <span className="max-w-full truncate font-medium text-secondary">{conversation.title}</span>
          {conversation.isAwaitingAnswer ? (
            <Badge
              variant="primary"
              size="sm"
              className="shrink-0"
            >
              {formatMessage(conversationMessages.needsAnswer)}
            </Badge>
          ) : null}
        </div>
        {preview ? <p className="m-0 mt-0.5 truncate text-sm text-muted-foreground">{preview}</p> : null}
      </TableCell>
      {/* A phone has no room for them beside the title, which matters more */}
      <TableCell className="max-sm:hidden">
        <CompanyAspectIcons
          aspects={conversation.aspects}
          size={14}
          className="gap-1.5 text-neutral-500"
        />
      </TableCell>
      <TableCell
        align="right"
        className="whitespace-nowrap text-muted-foreground"
      >
        <ConversationUpdatedAt
          updatedAt={conversation.updatedAt}
          now={now}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Tooltip content={formatMessage(conversationMessages.delete)}>
            <Button
              variant="transparent"
              size="sm"
              icon={<Trash2Icon />}
              confirm={formatMessage(conversationMessages.confirm)}
              aria-label={formatMessage(conversationMessages.deleteLabel, { title: conversation.title })}
              onClick={() => onDelete(conversation)}
            />
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default ConversationRow
