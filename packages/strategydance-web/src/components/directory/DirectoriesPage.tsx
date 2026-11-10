import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'
import { Tabs } from 'strategydance-design-system/components/ui/Tabs'
import type {
  DirectoryBusinessModel,
  DirectoryCategory,
  DirectoryType,
} from 'strategydance-knowledge/src/directories/enums'

import useDirectories from '~hooks/directory/useDirectories'
import useDirectoryStates from '~hooks/directory/useDirectoryStates'

import countDirectoryStatuses from '~utils/directory/countDirectoryStatuses'
import filterDirectories from '~utils/directory/filterDirectories'
import { DIRECTORIES_VIEWS } from '~utils/directory/parseDirectoriesSearch'

import DirectoriesBackLink from '~components/directory/DirectoriesBackLink'
import DirectoriesEmpty from '~components/directory/DirectoriesEmpty'
import DirectoriesFilters from '~components/directory/DirectoriesFilters'
import DirectoriesLoadFailed from '~components/directory/DirectoriesLoadFailed'
import DirectoriesTable from '~components/directory/DirectoriesTable'
import ContainerLayout from '~components/layout/ContainerLayout'
import PageHeader from '~components/layout/PageHeader'
import PageToolbar from '~components/layout/PageToolbar'

import aspectPunchlineMessages from '~data/intl/aspectPunchlineMessages'
import directoryStatusMessages from '~data/intl/directoryStatusMessages'
import directoryMessages from '~data/intl/messages/directory'

// Each tab's name, a status's or every directory's
const TAB_MESSAGES = {
  todo: directoryStatusMessages.TO_DO,
  submitted: directoryStatusMessages.SUBMITTED,
  listed: directoryStatusMessages.LISTED,
  dismissed: directoryStatusMessages.DISMISSED,
  all: directoryMessages.allTab,
} as const

/*
  The Directories page, under the Marketing aspect: every place a startup can be listed in that
  takes a submission today, by name, on the tab of a status, kept in the address, To do when it
  names none, with a search and filters over them. The search and the filters live here, so they
  last while a directory is open over the page, and go once the reader leaves it
*/
function DirectoriesPage() {
  const { formatMessage } = useIntl()
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/directories' })
  const navigate = useNavigate({ from: '/$organizationSlug/directories' })
  const { data: directories, hasFailed: haveDirectoriesFailed } = useDirectories()
  const { data: states, hasFailed: haveStatesFailed } = useDirectoryStates()
  const [query, setQuery] = useState('')
  const [businessModels, setBusinessModels] = useState<DirectoryBusinessModel[]>([])
  const [categories, setCategories] = useState<DirectoryCategory[]>([])
  const [type, setType] = useState<DirectoryType | null>(null)

  const hasFailed = haveDirectoriesFailed || haveStatesFailed
  const view = search.view ?? 'todo'
  const counts = countDirectoryStatuses(directories, states)
  const shown = filterDirectories(directories, states, { view, query, businessModels, categories, type })
  const isFiltered = Boolean(query.trim()) || businessModels.length > 0 || categories.length > 0 || type !== null

  function clearFilters() {
    setQuery('')
    setBusinessModels([])
    setCategories([])
    setType(null)
  }

  function renderList() {
    if (shown.length) {
      return (
        <DirectoriesTable
          directories={shown}
          states={states}
        />
      )
    }

    return (
      <DirectoriesEmpty
        view={view}
        onClear={isFiltered ? clearFilters : undefined}
      />
    )
  }

  return (
    <ContainerLayout className="gap-8">
      <PageHeader
        back={<DirectoriesBackLink />}
        eyebrow={formatMessage(aspectPunchlineMessages[CompanyAspect.MARKETING])}
        title={formatMessage(directoryMessages.title)}
        lead={
          hasFailed
            ? undefined
            : formatMessage(directoryMessages.lead, {
                count: counts.all,
                listed: counts.listed,
                submitted: counts.submitted,
              })
        }
      />
      {hasFailed ? (
        <DirectoriesLoadFailed />
      ) : (
        <div className="@container flex flex-col gap-4">
          <Tabs
            aria-label={formatMessage(directoryMessages.tabsLabel)}
            value={view}
            onValueChange={nextView =>
              navigate({
                search: { view: DIRECTORIES_VIEWS.find(tab => tab === nextView && tab !== 'todo') },
                resetScroll: false,
              })
            }
            items={DIRECTORIES_VIEWS.map(tab => ({
              value: tab,
              label: formatMessage(TAB_MESSAGES[tab]),
              count: counts[tab],
            }))}
          />
          <PageToolbar
            actions={
              <span
                aria-live="polite"
                className="text-sm whitespace-nowrap text-muted-foreground"
              >
                {formatMessage(directoryMessages.count, { count: shown.length })}
              </span>
            }
          >
            <DirectoriesFilters
              query={query}
              businessModels={businessModels}
              categories={categories}
              type={type}
              isFiltered={isFiltered}
              onQueryChange={setQuery}
              onBusinessModelsChange={setBusinessModels}
              onCategoriesChange={setCategories}
              onTypeChange={setType}
              onClear={clearFilters}
            />
          </PageToolbar>
          {renderList()}
        </div>
      )}
    </ContainerLayout>
  )
}

export default DirectoriesPage
