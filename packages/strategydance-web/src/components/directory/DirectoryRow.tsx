import { Link, useNavigate } from '@tanstack/react-router'
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryState } from '~types'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toDirectoryHost from '~utils/directory/toDirectoryHost'

import DirectoryBusinessModelBadge from '~components/directory/DirectoryBusinessModelBadge'
import DirectoryStatusBadge from '~components/directory/DirectoryStatusBadge'

import directoryCategoryMessages from '~data/intl/directoryCategoryMessages'
import directoryMessages from '~data/intl/messages/directory'

type Props = {
  directory: Directory
  // What the organization keeps of it, nothing for one never touched
  state: DirectoryState | undefined
}

/*
  One directory of the Directories page: its name, with a mark when the team noted it, a Reddit
  community or a site lately unreachable, its description, or its address before it has one, what
  it charges, the kinds of product it lists, where the organization stands with it, and a link to
  its submission page, which opens in a new tab. A click anywhere else on the row opens the
  directory's dialog; its name is the link the keyboard reaches
*/
function DirectoryRow({ directory, state }: Props) {
  const { formatMessage } = useIntl()
  const navigate = useNavigate()
  const organizationSlug = useCurrentOrganizationSlug()

  const hasNotes = Boolean(state?.notesText?.trim())

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    const { target, currentTarget } = event

    if (!(target instanceof Element) || !currentTarget.contains(target)) return
    if (target.closest('button, a, input, label')) return

    navigate({
      to: '/$organizationSlug/directories/$directoryId',
      params: { organizationSlug, directoryId: directory.id },
      state: { isFromDirectoriesPage: true },
      resetScroll: false,
    })
  }

  return (
    <TableRow
      onClick={handleClick}
      className="cursor-pointer"
    >
      <TableCell className="w-full max-w-0">
        <div className="flex max-w-[440px] flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              to="/$organizationSlug/directories/$directoryId"
              params={{ organizationSlug, directoryId: directory.id }}
              state={{ isFromDirectoriesPage: true }}
              resetScroll={false}
              className="truncate rounded-xs font-semibold text-secondary no-underline hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              {directory.name}
              {hasNotes ? <span className="sr-only">, {formatMessage(directoryMessages.hasNotes)}</span> : null}
            </Link>
            {hasNotes ? (
              <Tooltip content={formatMessage(directoryMessages.hasNotes)}>
                <span className="inline-flex shrink-0 text-neutral-400">
                  <FileTextIcon
                    aria-hidden="true"
                    className="size-3.5"
                  />
                </span>
              </Tooltip>
            ) : null}
            {directory.type === 'REDDIT_COMMUNITY' ? (
              <Badge
                size="sm"
                variant="secondary"
              >
                {formatMessage(directoryMessages.reddit)}
              </Badge>
            ) : null}
            {directory.unreachableSince ? (
              <Badge
                size="sm"
                variant="danger"
              >
                {formatMessage(directoryMessages.unreachable)}
              </Badge>
            ) : null}
          </div>
          <p className="m-0 line-clamp-2 text-xs leading-[1.45] whitespace-normal text-muted-foreground">
            {directory.description || toDirectoryHost(directory.rootUrl)}
          </p>
        </div>
      </TableCell>
      <TableCell className="@max-[560px]:hidden">
        <DirectoryBusinessModelBadge businessModel={directory.businessModel} />
      </TableCell>
      <TableCell className="@max-[800px]:hidden">
        <span className="block max-w-45 text-xs whitespace-normal text-muted-foreground">
          {directory.categories.map(category => formatMessage(directoryCategoryMessages[category])).join(', ')}
        </span>
      </TableCell>
      <TableCell>
        <DirectoryStatusBadge status={state?.status ?? null} />
      </TableCell>
      <TableCell className="pl-0 @max-[480px]:hidden">
        <Tooltip content={formatMessage(directoryMessages.openSubmissionPage)}>
          <a
            href={directory.submissionUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={formatMessage(directoryMessages.openSubmissionPageOf, { name: directory.name })}
            className={buttonVariants({ variant: 'transparent', size: 'sm', iconOnly: true })}
          >
            <ExternalLinkIcon />
          </a>
        </Tooltip>
      </TableCell>
    </TableRow>
  )
}

export default DirectoryRow
