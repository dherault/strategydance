import { Link } from '@tanstack/react-router'
import type { MouseEvent } from 'react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toDirectoryHost from '~utils/directory/toDirectoryHost'

import DirectoryBusinessModelBadge from '~components/directory/DirectoryBusinessModelBadge'

import directoryMessages from '~data/intl/messages/directory'

type Props = {
  directory: Directory
  // Opens the directory's dialog in place, over the page the card is on
  onOpen: () => void
}

/*
  A directory suggested next, as the Marketing aspect's page shows it: its name and host, its
  description in two lines, what it charges and whether it is a Reddit community. A link to its
  address on the Directories page, which a click with a modifier or the middle button follows, in a
  new tab or window, while a plain click opens its dialog over the Marketing page, as the design
  has it
*/
function DirectoryCard({ directory, onOpen }: Props) {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return

    event.preventDefault()
    onOpen()
  }

  return (
    <Link
      to="/$organizationSlug/directories/$directoryId"
      params={{ organizationSlug, directoryId: directory.id }}
      className="box-border flex min-h-33 min-w-0 flex-col gap-2 rounded-xs border border-neutral-200 bg-white p-4 text-foreground no-underline transition-colors duration-150 ease-in-out hover:border-neutral-300 hover:bg-neutral-50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      onClick={handleClick}
    >
      <div className="min-w-0">
        <h3 className="m-0 font-sans text-base leading-[1.35] font-semibold wrap-anywhere text-secondary">
          {directory.name}
        </h3>
        <span className="text-xs text-muted-foreground">{toDirectoryHost(directory.rootUrl)}</span>
      </div>
      {directory.description ? (
        <p className="m-0 line-clamp-2 text-sm leading-normal wrap-anywhere text-muted-foreground">
          {directory.description}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <DirectoryBusinessModelBadge businessModel={directory.businessModel} />
        {directory.type === 'REDDIT_COMMUNITY' ? (
          <Badge
            size="sm"
            variant="secondary"
          >
            {formatMessage(directoryMessages.reddit)}
          </Badge>
        ) : null}
      </div>
    </Link>
  )
}

export default DirectoryCard
