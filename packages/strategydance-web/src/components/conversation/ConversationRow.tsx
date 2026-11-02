import { Link, useNavigate } from '@tanstack/react-router'
import { PictureInPicture2Icon, Trash2Icon } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import type { ConversationSummary } from '~types'

import useConversationDock from '~hooks/conversation/useConversationDock'
import useIsConversationAuthor from '~hooks/conversation/useIsConversationAuthor'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import formatConversationPreview from '~utils/conversation/formatConversationPreview'

import CompanyAspectIcons from '~components/company/CompanyAspectIcons'
import ConversationAuthorAvatar from '~components/conversation/ConversationAuthorAvatar'
import ConversationUpdatedAt from '~components/conversation/ConversationUpdatedAt'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversation: ConversationSummary
  now: number
  onDelete: (conversation: ConversationSummary) => void
}

/*
  One conversation of the list: the face of the member who started it, its title, with a badge when
  a question waits for the reader, a line of its last entry under it, its aspects, when it last
  changed, and, on one of the reader's own, "Open in dock" on a wide screen, which has a dock, and
  Delete, which asks twice. Another member's is the reader's to read alone.

  The title links to the conversation, which is what the keyboard and a new tab use, and a click
  anywhere else on the row opens it too, as the design has it, unless it selected some text. The
  actions keep their clicks to themselves: Delete's confirmation sits in a portal, whose clicks
  React passes up to the row all the same
*/
function ConversationRow({ conversation, now, onDelete }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()
  const { isMobile } = useSidebar()
  const { windows, openWindow } = useConversationDock()
  const isAuthor = useIsConversationAuthor(conversation)

  const preview = formatConversationPreview(intl, conversation, now)
  const isDocked = windows.some(({ conversationId }) => conversationId === conversation.id)

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (event.target instanceof Element && event.target.closest('a, button')) return
    if (window.getSelection()?.toString()) return

    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId: conversation.id },
    })
  }

  return (
    <TableRow
      onClick={handleClick}
      className="cursor-pointer"
    >
      <TableCell className="pr-0">
        <ConversationAuthorAvatar
          author={conversation.user}
          hasTooltip
        />
      </TableCell>
      {/* The column takes what the others leave, and its lines are cut short to fit it */}
      <TableCell className="w-full max-w-0">
        {/* On a phone the badge goes under the title rather than leave it a letter or two */}
        <div className="flex min-w-0 items-center gap-x-2 gap-y-1 overflow-hidden max-sm:flex-wrap">
          <Link
            to="/$organizationSlug/conversations/$conversationId"
            params={{ organizationSlug, conversationId: conversation.id }}
            className="max-w-full truncate rounded-xs font-medium text-secondary no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {conversation.title}
          </Link>
          {isAuthor && conversation.isAwaitingAnswer ? (
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
      <TableCell onClick={event => event.stopPropagation()}>
        <div className="flex justify-end gap-1">
          {isMobile || !isAuthor ? null : (
            <Tooltip
              content={formatMessage(isDocked ? conversationMessages.showInDock : conversationMessages.openInDock)}
            >
              <Button
                variant="transparent"
                size="sm"
                icon={<PictureInPicture2Icon />}
                aria-label={formatMessage(
                  isDocked ? conversationMessages.showInDockLabel : conversationMessages.openInDockLabel,
                  { title: conversation.title },
                )}
                onClick={() => openWindow(conversation.id)}
              />
            </Tooltip>
          )}
          {isAuthor ? (
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
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

export default ConversationRow
