import { type KeyboardEvent, type Ref, useEffect, useId, useState } from 'react'
import { useIntl } from 'react-intl'
import { Input } from 'strategydance-design-system/components/ui/Input'
import {
  SuggestionList,
  SuggestionListItem,
  SuggestionListLabel,
  SuggestionListOptions,
} from 'strategydance-design-system/components/ui/SuggestionList'

import suggestBillCompanies from '~utils/budget/suggestBillCompanies'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  id: string
  value: string
  // Every company the organization's bills paid, as `listBillCompanies` lists them
  companies: readonly string[]
  maxLength: number
  isInvalid?: boolean
  describedBy?: string
  ref?: Ref<HTMLInputElement>
  onChange: (company: string) => void
  onBlur: () => void
}

/*
  The company a bill paid, typed, with the companies the organization paid before suggested under
  it while it has the focus: those holding what is typed, case aside, but the one it names already.
  The field keeps the focus throughout, its arrows moving through the list and Enter picking. While
  the list is open, Escape closes it rather than the dialog: a Radix dialog hears an Escape on the
  document before the field does, so the key is claimed on the window first, as the rich text
  editor claims it for its menus
*/
function BillCompanyField({ id, value, companies, maxLength, isInvalid, describedBy, ref, onChange, onBlur }: Props) {
  const { formatMessage } = useIntl()
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const suggestions = isOpen ? suggestBillCompanies(companies, value) : []
  const isListShown = suggestions.length > 0
  const highlighted = highlightedIndex < suggestions.length ? highlightedIndex : -1

  useEffect(() => {
    if (!isListShown) return

    function claimEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopPropagation()
      setIsOpen(false)
    }

    window.addEventListener('keydown', claimEscape, { capture: true })

    return () => window.removeEventListener('keydown', claimEscape, { capture: true })
  }, [isListShown])

  function getOptionId(index: number) {
    return `${listId}-${index}`
  }

  function pick(company: string) {
    onChange(company)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()

      if (!isOpen) {
        setIsOpen(true)

        return
      }

      if (!suggestions.length) return

      const step = event.key === 'ArrowDown' ? 1 : -1

      setHighlightedIndex(
        (highlighted + step + suggestions.length + (highlighted < 0 && step < 0 ? 1 : 0)) % suggestions.length,
      )

      return
    }

    if (event.key === 'Enter' && isListShown && highlighted >= 0) {
      event.preventDefault()
      pick(suggestions[highlighted]!)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        value={value}
        role="combobox"
        autoComplete="off"
        maxLength={maxLength}
        placeholder={formatMessage(budgetMessages.companyPlaceholder)}
        aria-autocomplete="list"
        aria-expanded={isListShown}
        aria-controls={isListShown ? listId : undefined}
        aria-activedescendant={isListShown && highlighted >= 0 ? getOptionId(highlighted) : undefined}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        onChange={event => {
          onChange(event.target.value)
          setIsOpen(true)
          setHighlightedIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onBlur={() => {
          setIsOpen(false)
          onBlur()
        }}
        onKeyDown={handleKeyDown}
      />
      {isListShown ? (
        <SuggestionList className="absolute inset-x-0 top-[calc(100%+4px)] max-h-60">
          <SuggestionListLabel id={`${listId}-label`}>
            {formatMessage(budgetMessages.companiesPaidBefore)}
          </SuggestionListLabel>
          <SuggestionListOptions
            id={listId}
            aria-labelledby={`${listId}-label`}
          >
            {suggestions.map((company, index) => (
              <SuggestionListItem
                key={company}
                id={getOptionId(index)}
                isHighlighted={index === highlighted}
                onPointerMove={() => setHighlightedIndex(index)}
                onClick={() => pick(company)}
              >
                <span className="min-w-0 flex-1 truncate">{company}</span>
              </SuggestionListItem>
            ))}
          </SuggestionListOptions>
        </SuggestionList>
      ) : null}
    </div>
  )
}

export default BillCompanyField
