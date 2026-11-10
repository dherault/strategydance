import type { KeyboardEvent } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'
import { SearchInput } from 'strategydance-design-system/components/ui/SearchInput'
import { Select } from 'strategydance-design-system/components/ui/Select'
import {
  type DirectoryBusinessModel,
  type DirectoryCategory,
  DirectoryType,
} from 'strategydance-knowledge/src/directories/enums'

import { DIRECTORY_BUSINESS_MODELS, DIRECTORY_CATEGORIES } from '~constants'

import directoryBusinessModelMessages from '~data/intl/directoryBusinessModelMessages'
import directoryCategoryMessages from '~data/intl/directoryCategoryMessages'
import directoryMessages from '~data/intl/messages/directory'

// The filter by type's choice of either type, which no type is named
const EVERY_TYPE = 'all'

type Props = {
  query: string
  businessModels: DirectoryBusinessModel[]
  categories: DirectoryCategory[]
  // Either type when null
  type: DirectoryType | null
  // Whether any of them narrows the list, which offers to clear them
  isFiltered: boolean
  onQueryChange: (query: string) => void
  onBusinessModelsChange: (businessModels: DirectoryBusinessModel[]) => void
  onCategoriesChange: (categories: DirectoryCategory[]) => void
  onTypeChange: (type: DirectoryType | null) => void
  onClear: () => void
}

/*
  What narrows the Directories page under its tab: words its directories' names, descriptions,
  addresses or the team's notes hold, what they charge, the kinds of product they list and whether
  they are websites or Reddit communities, with a way back to them all. Laid in the page's toolbar,
  from its left. Escape empties the search
*/
function DirectoriesFilters({
  query,
  businessModels,
  categories,
  type,
  isFiltered,
  onQueryChange,
  onBusinessModelsChange,
  onCategoriesChange,
  onTypeChange,
  onClear,
}: Props) {
  const { formatMessage } = useIntl()

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape' || !query) return

    event.preventDefault()
    onQueryChange('')
  }

  // The words every multi-select of the toolbar shares
  const multiSelectLabels = {
    searchPlaceholder: formatMessage(directoryMessages.filterSearch),
    emptyText: formatMessage(directoryMessages.filterNoMatch),
    clearLabel: formatMessage(directoryMessages.filterClear),
    closeLabel: formatMessage(directoryMessages.filterClose),
    moreLabel: (count: number) => formatMessage(directoryMessages.filterMore, { count }),
  }

  return (
    <>
      <SearchInput
        value={query}
        placeholder={formatMessage(directoryMessages.search)}
        aria-label={formatMessage(directoryMessages.searchLabel)}
        className="min-w-36 flex-[1_1_200px] sm:max-w-60 @max-[460px]:basis-full"
        onChange={event => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <MultiSelect
        value={businessModels}
        placeholder={formatMessage(directoryMessages.pricingPlaceholder)}
        aria-label={formatMessage(directoryMessages.pricingFilterLabel)}
        options={DIRECTORY_BUSINESS_MODELS.map(businessModel => ({
          value: businessModel,
          label: formatMessage(directoryBusinessModelMessages[businessModel]),
        }))}
        className="min-w-32 flex-[0_1_176px] @max-[460px]:basis-full"
        onValueChange={value => onBusinessModelsChange(value as DirectoryBusinessModel[])}
        {...multiSelectLabels}
      />
      <MultiSelect
        value={categories}
        placeholder={formatMessage(directoryMessages.categoryPlaceholder)}
        aria-label={formatMessage(directoryMessages.categoryFilterLabel)}
        options={DIRECTORY_CATEGORIES.map(category => ({
          value: category,
          label: formatMessage(directoryCategoryMessages[category]),
        }))}
        className="min-w-32 flex-[0_1_160px] @max-[460px]:basis-full"
        onValueChange={value => onCategoriesChange(value as DirectoryCategory[])}
        {...multiSelectLabels}
      />
      <Select
        value={type ?? EVERY_TYPE}
        aria-label={formatMessage(directoryMessages.typeFilterLabel)}
        className="min-w-32 flex-[0_1_160px] @max-[460px]:basis-full"
        options={[
          { value: EVERY_TYPE, label: formatMessage(directoryMessages.allTypes) },
          { value: DirectoryType.WEBSITE, label: formatMessage(directoryMessages.websites) },
          { value: DirectoryType.REDDIT_COMMUNITY, label: formatMessage(directoryMessages.redditCommunities) },
        ]}
        onValueChange={value => onTypeChange(value === EVERY_TYPE ? null : (value as DirectoryType))}
      />
      {isFiltered ? (
        <Button
          variant="transparent"
          size="sm"
          onClick={onClear}
        >
          {formatMessage(directoryMessages.clearFilters)}
        </Button>
      ) : null}
    </>
  )
}

export default DirectoriesFilters
