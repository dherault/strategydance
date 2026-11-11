import { Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from 'strategydance-design-system/components/ui/Empty'
import { Spinner } from 'strategydance-design-system/components/ui/Spinner'

import { NEXT_DIRECTORIES_SHOWN } from '~constants'

import useDirectories from '~hooks/directory/useDirectories'
import useDirectoryStates from '~hooks/directory/useDirectoryStates'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import countDirectoryStatuses from '~utils/directory/countDirectoryStatuses'
import rankNextDirectories from '~utils/directory/rankNextDirectories'

import DirectoriesLoadFailed from '~components/directory/DirectoriesLoadFailed'
import DirectoryCard from '~components/directory/DirectoryCard'
import DirectoryDialog from '~components/directory/DirectoryDialog'
import PageSection from '~components/layout/PageSection'

import directoryMessages from '~data/intl/messages/directory'
import globalMessages from '~data/intl/messages/global'

/*
  The Directories section of the Marketing aspect's page: how many directories list the product,
  wait on a submission and are still to do, the next few to do as cards, two rows of three where
  there is room, and the way to the Directories page. A card opens its directory's dialog over this
  page rather than leaving it. The page waits on its documents alone, so the section waits on the
  directories itself, the release's list downloading apart
*/
function AspectDirectories() {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()
  const directories = useDirectories()
  const states = useDirectoryStates()
  const [openId, setOpenId] = useState<string | null>(null)

  const counts = countDirectoryStatuses(directories.data, states.data)
  const next = rankNextDirectories(directories.data, states.data, NEXT_DIRECTORIES_SHOWN)
  const openDirectory = openId === null ? null : (directories.data.find(({ id }) => id === openId) ?? null)
  const strong = (chunks: ReactNode) => <strong className="font-semibold text-secondary">{chunks}</strong>

  function renderBody() {
    if (directories.hasFailed || states.hasFailed) return <DirectoriesLoadFailed />

    if (directories.initialLoading || states.initialLoading) {
      return (
        <div
          role="status"
          aria-label={formatMessage(globalMessages.loading)}
          className="flex min-h-33 items-center justify-center"
        >
          <Spinner aria-hidden="true" />
        </div>
      )
    }

    return (
      <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span>{formatMessage(directoryMessages.progressListed, { count: counts.listed, strong })}</span>
          <span>{formatMessage(directoryMessages.progressSubmitted, { count: counts.submitted, strong })}</span>
          <span>{formatMessage(directoryMessages.progressToDo, { count: counts.todo, strong })}</span>
        </div>
        {next.length ? (
          <div className="@container">
            <div className="grid grid-cols-3 gap-4 @max-[720px]:grid-cols-2 @max-[460px]:grid-cols-1">
              {next.map(directory => (
                <DirectoryCard
                  key={directory.id}
                  directory={directory}
                  onOpen={() => setOpenId(directory.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <Empty size="sm">
            <EmptyHeader>
              <EmptyTitle>{formatMessage(directoryMessages.allDoneTitle)}</EmptyTitle>
              <EmptyDescription>{formatMessage(directoryMessages.allDoneText)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </>
    )
  }

  return (
    <PageSection
      title={formatMessage(directoryMessages.title)}
      description={formatMessage(directoryMessages.sectionDescription)}
      actions={
        <Link
          to="/$organizationSlug/directories"
          params={{ organizationSlug }}
          className={buttonVariants({ size: 'sm' })}
        >
          {formatMessage(directoryMessages.viewAll)}
        </Link>
      }
    >
      {renderBody()}
      {openDirectory ? (
        <DirectoryDialog
          key={openDirectory.id}
          directory={openDirectory}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </PageSection>
  )
}

export default AspectDirectories
