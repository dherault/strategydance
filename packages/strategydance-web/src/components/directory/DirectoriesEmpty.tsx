import { SearchIcon, SignpostIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import type { DirectoriesView } from '~types'

import directoryMessages from '~data/intl/messages/directory'

// Each status tab's title once it holds no directory
const TITLES = {
  todo: directoryMessages.toDoEmptyTitle,
  submitted: directoryMessages.submittedEmptyTitle,
  listed: directoryMessages.listedEmptyTitle,
  dismissed: directoryMessages.dismissedEmptyTitle,
  all: directoryMessages.noMatchTitle,
} as const

type Props = {
  view: DirectoriesView
  // Set while the search or a filter narrows the list, which then offers to clear them
  onClear?: () => void
}

/*
  The Directories page when its tab holds no directory, or its search and filters leave none, with
  a way back to them all
*/
function DirectoriesEmpty({ view, onClear }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>{onClear ? <SearchIcon /> : <SignpostIcon />}</EmptyMedia>
        <EmptyTitle>{formatMessage(onClear ? directoryMessages.noMatchTitle : TITLES[view])}</EmptyTitle>
        <EmptyDescription>
          {formatMessage(onClear ? directoryMessages.noMatchText : directoryMessages.emptyText)}
        </EmptyDescription>
      </EmptyHeader>
      {onClear ? (
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
          >
            {formatMessage(directoryMessages.clearFilters)}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

export default DirectoriesEmpty
