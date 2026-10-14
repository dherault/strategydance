import type { ReactNode } from 'react'

/*
  The options of the design system's Base UI comboboxes, `MultiSelect` and `Combobox`: given as
  strings or objects, loose or in groups, and read as groups, a run of loose options between two
  groups becoming an unlabeled group of its own
*/

type ComboboxOption = {
  value: string
  label: ReactNode
  disabled?: boolean
  /** More words the search matches, beside the label */
  keywords?: string[]
}

type ComboboxGroup = {
  label?: ReactNode
  options: (ComboboxOption | string)[]
}

type ComboboxOptionGroup = {
  label?: ReactNode
  options: ComboboxOption[]
}

function toComboboxOption(option: ComboboxOption | string): ComboboxOption {
  return typeof option === 'string' ? { value: option, label: option } : option
}

function isComboboxGroup(option: ComboboxOption | ComboboxGroup | string): option is ComboboxGroup {
  return typeof option === 'object' && 'options' in option
}

function toComboboxGroups(options: (ComboboxOption | ComboboxGroup | string)[]) {
  const groups: ComboboxOptionGroup[] = []
  let looseGroup: ComboboxOptionGroup | null = null

  for (const option of options) {
    if (isComboboxGroup(option)) {
      groups.push({ label: option.label, options: option.options.map(toComboboxOption) })
      looseGroup = null
    } else {
      if (!looseGroup) {
        looseGroup = { options: [] }
        groups.push(looseGroup)
      }

      looseGroup.options.push(toComboboxOption(option))
    }
  }

  return groups
}

// What the search reads an option by: its label when it is a string, else its value, and its keywords
function getComboboxSearchTexts(option: ComboboxOption) {
  return [typeof option.label === 'string' ? option.label : option.value, ...(option.keywords ?? [])]
}

export { getComboboxSearchTexts, toComboboxGroups }
export type { ComboboxGroup, ComboboxOption, ComboboxOptionGroup }
