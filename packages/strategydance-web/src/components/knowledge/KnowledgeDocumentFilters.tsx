import type { KeyboardEvent } from 'react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'
import { SearchInput } from 'strategydance-design-system/components/ui/SearchInput'

import { COMPANY_ASPECTS } from '~constants'

import aspectMessages from '~data/intl/aspectMessages'
import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  query: string
  aspects: CompanyAspect[]
  onQueryChange: (query: string) => void
  onAspectsChange: (aspects: CompanyAspect[]) => void
}

/*
  What narrows the Knowledge page: words its documents' titles hold, and the aspects they are
  tagged with. Laid in the page's toolbar, from its left. Escape empties the search.

  The search is as wide as the first column of cards under it, so it ends where that card ends: its
  container queries read the page's container, as wide as the grid's own, at the grid's breakpoints
  and gap (`KnowledgeDocumentGrid`), which change with them
*/
function KnowledgeDocumentFilters({ query, aspects, onQueryChange, onAspectsChange }: Props) {
  const { formatMessage } = useIntl()

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape' || !query) return

    event.preventDefault()
    onQueryChange('')
  }

  return (
    <>
      <SearchInput
        value={query}
        placeholder={formatMessage(knowledgeMessages.searchPlaceholder)}
        aria-label={formatMessage(knowledgeMessages.searchPlaceholder)}
        className="w-[calc((100%-2rem)/3)] flex-none @max-[720px]:w-[calc((100%-1rem)/2)] @max-[460px]:w-full"
        onChange={event => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <MultiSelect
        value={aspects}
        placeholder={formatMessage(knowledgeMessages.aspectsFilterPlaceholder)}
        aria-label={formatMessage(knowledgeMessages.aspectsFilterLabel)}
        searchPlaceholder={formatMessage(knowledgeMessages.aspectsFilterSearch)}
        emptyText={formatMessage(knowledgeMessages.aspectsFilterEmpty)}
        clearLabel={formatMessage(knowledgeMessages.aspectsFilterClear)}
        closeLabel={formatMessage(knowledgeMessages.aspectsFilterClose)}
        moreLabel={count => formatMessage(knowledgeMessages.aspectsFilterMore, { count })}
        className="min-w-50 flex-[0_1_240px]"
        options={COMPANY_ASPECTS.map(aspect => ({ value: aspect, label: formatMessage(aspectMessages[aspect]) }))}
        onValueChange={values => onAspectsChange(values as CompanyAspect[])}
      />
    </>
  )
}

export default KnowledgeDocumentFilters
