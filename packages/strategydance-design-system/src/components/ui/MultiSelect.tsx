import { Combobox } from '@base-ui/react/combobox'
import { ChevronDownIcon, SearchIcon, XIcon } from 'lucide-react'
import {
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Field, fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'
import { cn } from 'strategydance-design-system/lib/utils'

// The row that selects every option is not an option, but rides the list as one so the keyboard
// reaches it. Its value never reaches the selection
const SELECT_ALL_VALUE = '\u0000select-all'

// The chips' gap, which the fitting arithmetic has to know
const CHIP_GAP = 4

const chipClassName =
  'box-border inline-flex h-6.5 max-w-full flex-none items-center gap-0.5 rounded-xs border border-border bg-white pr-0.75 pl-2 text-xs font-medium text-neutral-700'

const moreChipClassName = cn(chipClassName, 'bg-neutral-100 px-2 text-muted-foreground')

const footerButtonClassName =
  'h-9 flex-1 cursor-pointer text-sm text-foreground outline-none transition-colors duration-150 ease-in-out hover:bg-neutral-50 hover:text-secondary focus-visible:bg-neutral-50 focus-visible:text-secondary'

type MultiSelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
  /** More words the search matches, beside the label */
  keywords?: string[]
}

type MultiSelectGroup = {
  label?: ReactNode
  options: (MultiSelectOption | string)[]
}

type Props = {
  /** Options, as strings or objects, or groups of them, which get a label and separators */
  options: (MultiSelectOption | MultiSelectGroup | string)[]
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: ReactNode
  searchPlaceholder?: string
  /** Shown when the search matches nothing */
  emptyText?: ReactNode
  /** Adds a row that selects every enabled option, hidden while searching */
  selectAll?: boolean
  /** Caps the chips shown. Without it, the chips fill one line and the rest collapse into a count */
  maxCount?: number
  /** Adds a button to the trigger that clears the selection */
  clearable?: boolean
  label?: ReactNode
  hint?: ReactNode
  /** Marks the select invalid and replaces the hint */
  error?: ReactNode
  disabled?: boolean
  /** Submits one value per selected option with a form under this name */
  name?: string
  id?: string
  defaultOpen?: boolean
  /** The side of the trigger the list opens on */
  side?: 'bottom' | 'top'
  /** Names the select when it has no visible label */
  'aria-label'?: string
  /** The "Select all" row. Defaults to "Select all" */
  selectAllLabel?: string
  /** The footer button that clears the selection. Defaults to "Clear" */
  clearLabel?: string
  /** The footer button that closes the list. Defaults to "Close" */
  closeLabel?: string
  /** The chip that counts the options left out. Defaults to "+N more" */
  moreLabel?: (count: number) => string
  className?: string
}

type OptionGroup = {
  label?: ReactNode
  options: MultiSelectOption[]
}

// The combobox's own items are the options' values, in groups when the list shows any
type ItemGroup = {
  value: string
  label?: ReactNode
  items: string[]
}

function toOption(option: MultiSelectOption | string): MultiSelectOption {
  return typeof option === 'string' ? { value: option, label: option } : option
}

function isGroup(option: MultiSelectOption | MultiSelectGroup | string): option is MultiSelectGroup {
  return typeof option === 'object' && 'options' in option
}

// A run of loose options between groups becomes an unlabeled group of its own
function toGroups(options: Props['options']) {
  const groups: OptionGroup[] = []
  let looseGroup: OptionGroup | null = null

  for (const option of options) {
    if (isGroup(option)) {
      groups.push({ label: option.label, options: option.options.map(toOption) })
      looseGroup = null
    } else {
      if (!looseGroup) {
        looseGroup = { options: [] }
        groups.push(looseGroup)
      }

      looseGroup.options.push(toOption(option))
    }
  }

  return groups
}

// What the search reads an option by. A label that is not a string falls back to the value
function toSearchText(option: MultiSelectOption) {
  return typeof option.label === 'string' ? option.label : option.value
}

function preventFocusChange(event: MouseEvent) {
  event.preventDefault()
}

// The trigger opens on mousedown, so a button inside it keeps that event to itself
function stopTriggerPress(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function ItemCheckbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-xs border border-neutral-300 bg-white text-white transition-colors duration-150 ease-in-out',
        (checked || indeterminate) && 'border-primary bg-primary',
      )}
    >
      {checked ? (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3"
        >
          <path d="M2.5 6.25l2.25 2.25 4.75-5" />
        </svg>
      ) : null}
      {!checked && indeterminate ? (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          className="size-3"
        >
          <path d="M3 6h6" />
        </svg>
      ) : null}
    </span>
  )
}

type ItemProps = {
  value: string
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  children: ReactNode
}

function MultiSelectItem({ value, checked, indeterminate, disabled, children }: ItemProps) {
  return (
    <Combobox.Item
      value={value}
      disabled={disabled}
      // The "Select all" row is never in the selection, so it says what its box shows
      aria-selected={checked}
      className="flex min-h-8 cursor-pointer items-center gap-2 rounded-xs px-2 text-sm text-foreground outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-neutral-100 data-highlighted:text-secondary aria-selected:text-secondary"
    >
      <ItemCheckbox
        checked={checked}
        indeterminate={indeterminate}
      />
      {children}
    </Combobox.Item>
  )
}

type ChipProps = {
  label: ReactNode
  /** Lets the chip truncate its label, when it is the only one on the line */
  shrink?: boolean
  removable: boolean
  onRemove?: () => void
}

/*
  The remove button is for the pointer, and stays out of the tab order and the accessibility tree:
  the trigger reads its chips as its value, and Backspace or the list remove them from the keyboard
*/
function Chip({ label, shrink, removable, onRemove }: ChipProps) {
  return (
    <span className={cn(chipClassName, shrink && 'min-w-0 flex-initial')}>
      <span className="min-w-0 truncate">{label}</span>
      {removable ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onMouseDown={stopTriggerPress}
          onClick={event => {
            event.stopPropagation()
            onRemove?.()
          }}
          className="grid size-4.5 shrink-0 cursor-pointer place-items-center rounded-xs text-neutral-400 transition-colors duration-150 ease-in-out hover:bg-neutral-100 hover:text-secondary"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

/*
  shadcn's combobox, which is Base UI's, with the input inside the popup: a trigger dressed as an
  Input holds the selection as chips, and opens a search field over a list of checkbox rows, with
  optional groups and a row selecting everything. The chips stay on one line, and those that do
  not fit collapse into a "+N more" chip, which is counted in the fit.

  Backspace on the trigger, or in the empty search field, removes the last chip. With a label, hint
  or error it renders a Field around itself, and `className` goes to the Field
*/
function MultiSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  selectAll = false,
  maxCount,
  clearable = true,
  label,
  hint,
  error,
  disabled = false,
  name,
  id,
  defaultOpen = false,
  side = 'bottom',
  'aria-label': ariaLabel,
  selectAllLabel = 'Select all',
  clearLabel = 'Clear',
  closeLabel = 'Close',
  moreLabel = count => `+${count} more`,
  className,
}: Props) {
  const autoId = useId()
  const triggerId = id ?? autoId
  // Base UI's id for a Combobox.Label under a root with this id, which also names the popup
  const labelId = `${triggerId}-label`
  const messageId = `${triggerId}-message`
  const hasField = !!(label || hint || error)
  const [innerValue, setInnerValue] = useState(defaultValue ?? [])
  const [open, setOpen] = useState(defaultOpen)
  const currentValue = value ?? innerValue
  const searchInputRef = useRef<HTMLInputElement>(null)
  const valuesRef = useRef<HTMLSpanElement>(null)
  const chipsMeasureRef = useRef<HTMLSpanElement>(null)
  const countsMeasureRef = useRef<HTMLSpanElement>(null)
  const portalContainerRef = useRef<HTMLElement>(null)
  const [fitCount, setFitCount] = useState(currentValue.length)
  const { contains } = Combobox.useFilter()

  const groups = toGroups(options)
  const allOptions = groups.flatMap(group => group.options)
  const optionsByValue = new Map(allOptions.map(option => [option.value, option]))
  const enabledValues = allOptions.filter(option => !option.disabled).map(option => option.value)
  const hasSelectAll = selectAll && enabledValues.length > 1
  const isGrouped = hasSelectAll || groups.length > 1 || groups.some(group => group.label)
  const itemGroups: ItemGroup[] = [
    ...(hasSelectAll ? [{ value: 'select-all', items: [SELECT_ALL_VALUE] }] : []),
    ...groups.map((group, index) => ({
      value: String(index),
      label: group.label,
      items: group.options.map(option => option.value),
    })),
  ]
  const items = isGrouped ? itemGroups : allOptions.map(option => option.value)

  const isAllSelected =
    enabledValues.length > 0 && enabledValues.every(enabledValue => currentValue.includes(enabledValue))
  const isSomeSelected = !isAllSelected && enabledValues.some(enabledValue => currentValue.includes(enabledValue))

  // A value no option carries still shows, as itself
  const selectedOptions = currentValue.map(
    selectedValue => optionsByValue.get(selectedValue) ?? { value: selectedValue, label: selectedValue },
  )
  const selectedCount = selectedOptions.length
  const shownOptions = selectedOptions.slice(0, fitCount)
  const hiddenCount = selectedCount - shownOptions.length
  const selectionKey = currentValue.join('\u0000')
  // A whole number of chips, and none fewer than none
  const chipCap = maxCount === undefined ? undefined : Math.max(0, Math.floor(maxCount))

  /*
    Every chip renders once more out of sight, and so does the count for every number of chips it
    could stand for, since a translated count need not grow with its number. Their widths say how
    many chips fit on the line beside the count they leave. The cap bounds the fit rather than
    trimming it, so the count it brings in has its room. One chip always shows, unless the cap is 0
  */
  useLayoutEffect(() => {
    const values = valuesRef.current
    const chipsMeasure = chipsMeasureRef.current
    const countsMeasure = countsMeasureRef.current

    if (!values || !chipsMeasure || !countsMeasure) return

    const fitChips = () => {
      const widths = Array.from(chipsMeasure.children, child => (child as HTMLElement).offsetWidth)
      // The count's width for one hidden chip, then two, and so on
      const countWidths = Array.from(countsMeasure.children, child => (child as HTMLElement).offsetWidth)
      const available = values.clientWidth
      const totalWidth = widths.reduce((sum, width) => sum + width, 0) + CHIP_GAP * Math.max(widths.length - 1, 0)
      const limit = chipCap === undefined ? widths.length : Math.min(widths.length, chipCap)
      let count = widths.length

      // Short of every chip, some are hidden, and the count needs its room
      if (limit < widths.length || totalWidth > available) {
        let usedWidth = 0

        count = 0

        for (const [index, width] of widths.slice(0, limit).entries()) {
          const nextWidth = usedWidth + (index > 0 ? CHIP_GAP : 0) + width
          // The count beside the first `index + 1` chips stands for the rest
          const countWidth = countWidths[widths.length - index - 2]

          if (countWidth === undefined || nextWidth + CHIP_GAP + countWidth > available) break

          usedWidth = nextWidth
          count = index + 1
        }

        count = Math.max(count, Math.min(limit, 1))
      }

      setFitCount(count)
    }

    fitChips()

    const observer = new ResizeObserver(fitChips)

    observer.observe(values)
    observer.observe(chipsMeasure)
    observer.observe(countsMeasure)

    return () => observer.disconnect()
  }, [selectionKey, chipCap])

  // A Radix dialog dismisses on an Escape that reaches the document, which it hears before the
  // list does. It leaves a prevented one alone, and Base UI closes the list on it all the same, so
  // while the list is open the key closes the list and nothing else
  useEffect(() => {
    if (!open) return

    function claimEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') event.preventDefault()
    }

    window.addEventListener('keydown', claimEscape, { capture: true })

    return () => window.removeEventListener('keydown', claimEscape, { capture: true })
  }, [open])

  /*
    The list portals into the dialog around the trigger, if any. A modal Radix dialog traps focus,
    disables pointer events and hides from assistive technology everything outside itself, and a
    list at the end of the body is outside it
  */
  function findPortalContainer(trigger: HTMLElement | null) {
    portalContainerRef.current = trigger?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null
  }

  function updateValue(nextValue: string[]) {
    if (value === undefined) setInnerValue(nextValue)

    onValueChange?.(nextValue)
  }

  function removeValue(removedValue: string) {
    updateValue(currentValue.filter(selectedValue => selectedValue !== removedValue))
  }

  function handleValueChange(nextValue: string[]) {
    if (!nextValue.includes(SELECT_ALL_VALUE)) {
      updateValue(nextValue)

      return
    }

    // Disabled options keep whatever state they had
    updateValue(
      isAllSelected
        ? currentValue.filter(selectedValue => !enabledValues.includes(selectedValue))
        : [...new Set([...currentValue, ...enabledValues])],
    )
  }

  function filterItem(itemValue: string, query: string) {
    if (itemValue === SELECT_ALL_VALUE) return false

    const option = optionsByValue.get(itemValue)

    if (!option) return false

    return [toSearchText(option), ...(option.keywords ?? [])].some(text => contains(text, query))
  }

  function handleTriggerKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Backspace' || disabled || !currentValue.length) return

    event.preventDefault()
    updateValue(currentValue.slice(0, -1))
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace' || event.currentTarget.value || !currentValue.length) return

    event.preventDefault()
    updateValue(currentValue.slice(0, -1))
  }

  function handleClear() {
    updateValue([])
    // The footer leaves with the selection, and would take the focus with it
    searchInputRef.current?.focus()
  }

  function renderItem(itemValue: string) {
    if (itemValue === SELECT_ALL_VALUE) {
      return (
        <MultiSelectItem
          key={itemValue}
          value={itemValue}
          checked={isAllSelected}
          indeterminate={isSomeSelected}
        >
          {selectAllLabel}
        </MultiSelectItem>
      )
    }

    const option = optionsByValue.get(itemValue)

    return (
      <MultiSelectItem
        key={itemValue}
        value={itemValue}
        checked={currentValue.includes(itemValue)}
        disabled={option?.disabled}
      >
        {option?.label}
      </MultiSelectItem>
    )
  }

  const control = (
    <Combobox.Trigger
      ref={findPortalContainer}
      nativeButton={false}
      render={<div />}
      data-slot="multi-select-trigger"
      aria-label={ariaLabel}
      aria-invalid={error ? true : undefined}
      aria-describedby={hint || error ? messageId : undefined}
      onKeyDown={handleTriggerKeyDown}
      className={cn(
        inputClassName,
        'group flex h-auto min-h-10 cursor-pointer items-center gap-2 py-1.25 pr-2 pl-3 text-left data-disabled:cursor-not-allowed data-disabled:opacity-50 data-popup-open:border-secondary data-popup-open:bg-white',
        selectedCount > 0 && 'pl-1.5',
        !hasField && className,
      )}
    >
      <span
        ref={valuesRef}
        className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
      >
        {selectedCount === 0 ? <span className="truncate text-muted-foreground">{placeholder}</span> : null}
        {shownOptions.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            shrink={selectedCount === 1 || (fitCount === 1 && hiddenCount > 0)}
            removable={!disabled}
            onRemove={() => removeValue(option.value)}
          />
        ))}
        {hiddenCount > 0 ? <span className={moreChipClassName}>{moreLabel(hiddenCount)}</span> : null}
        {selectedCount > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-0 left-0 flex w-max gap-1 whitespace-nowrap"
          >
            <span
              ref={chipsMeasureRef}
              className="flex gap-1"
            >
              {selectedOptions.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  removable={!disabled}
                />
              ))}
            </span>
            <span
              ref={countsMeasureRef}
              className="flex gap-1"
            >
              {selectedOptions.map((option, index) => (
                <span
                  key={option.value}
                  className={moreChipClassName}
                >
                  {moreLabel(index + 1)}
                </span>
              ))}
            </span>
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {clearable && selectedCount > 0 && !disabled ? (
          <>
            {/* For the pointer only, as a chip's remove button is */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onMouseDown={stopTriggerPress}
              onClick={event => {
                event.stopPropagation()
                updateValue([])
              }}
              className="grid size-5 cursor-pointer place-items-center rounded-xs transition-colors duration-150 ease-in-out hover:bg-neutral-100 hover:text-secondary"
            >
              <XIcon className="size-3.5" />
            </button>
            <span
              aria-hidden="true"
              className="h-4 w-px bg-border"
            />
          </>
        ) : null}
        <ChevronDownIcon className="size-4 shrink-0 transition-transform duration-150 ease-out group-data-popup-open:rotate-180" />
      </span>
    </Combobox.Trigger>
  )

  return (
    <Combobox.Root
      multiple
      autoHighlight
      id={triggerId}
      items={items}
      filter={filterItem}
      value={currentValue}
      onValueChange={handleValueChange}
      // Keeps the search after a pick, so one query can select several of its matches
      onInputValueChange={(_, eventDetails) => {
        if (eventDetails.isItemPress) eventDetails.cancel()
      }}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      name={name}
    >
      {hasField ? (
        <Field
          hint={hint}
          error={error}
          messageId={messageId}
          className={className}
        >
          {label ? <Combobox.Label className={fieldLabelClassName}>{label}</Combobox.Label> : null}
          {control}
        </Field>
      ) : (
        control
      )}
      {/* Boxless, so it takes no row in a dialog's grid */}
      <Combobox.Portal
        container={portalContainerRef}
        className="contents"
      >
        <Combobox.Positioner
          side={side}
          sideOffset={4}
          align="start"
          className="z-50 outline-none"
        >
          <Combobox.Popup
            data-slot="multi-select-content"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
            className="flex max-h-(--available-height) w-(--anchor-width) flex-col overflow-hidden rounded-xs border border-border bg-popover font-sans text-popover-foreground shadow-md outline-none duration-150 ease-out data-open:animate-in data-open:fade-in-0 data-[side=bottom]:slide-in-from-top-[2px] data-[side=top]:slide-in-from-bottom-[2px]"
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 text-muted-foreground">
              <SearchIcon className="size-4 shrink-0" />
              <Combobox.Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={handleSearchKeyDown}
                // 16px on a touch screen, as `Input` is, or iOS zooms into it
                className="h-full min-w-0 flex-1 bg-transparent p-0 font-sans text-sm pointer-coarse:text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.Empty className="px-2 text-center text-sm text-muted-foreground not-empty:py-5">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List className="max-h-60 min-h-0 scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
              {isGrouped
                ? (group: ItemGroup, index: number) => (
                    <Fragment key={group.value}>
                      {index > 0 ? <Combobox.Separator className="-mx-1 my-1 h-px bg-border" /> : null}
                      <Combobox.Group items={group.items}>
                        {group.label ? (
                          <Combobox.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            {group.label}
                          </Combobox.GroupLabel>
                        ) : null}
                        <Combobox.Collection>{renderItem}</Combobox.Collection>
                      </Combobox.Group>
                    </Fragment>
                  )
                : renderItem}
            </Combobox.List>
            {selectedCount > 0 ? (
              <div className="flex shrink-0 border-t border-border">
                <button
                  type="button"
                  onMouseDown={preventFocusChange}
                  onClick={handleClear}
                  className={footerButtonClassName}
                >
                  {clearLabel}
                </button>
                <button
                  type="button"
                  onMouseDown={preventFocusChange}
                  onClick={() => setOpen(false)}
                  className={cn(footerButtonClassName, 'border-l border-border')}
                >
                  {closeLabel}
                </button>
              </div>
            ) : null}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

export { MultiSelect }
export type { MultiSelectGroup, MultiSelectOption }
