import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { Fragment, type ReactNode, useId, useState } from 'react'
import { Field, fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'
import useComboboxLayer from 'strategydance-design-system/hooks/useComboboxLayer'
import {
  type ComboboxGroup,
  type ComboboxOption,
  getComboboxSearchTexts,
  toComboboxGroups,
} from 'strategydance-design-system/lib/comboboxOptions'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = {
  /** Options, as strings or objects, or groups of them, which get a label and separators */
  options: (ComboboxOption | ComboboxGroup | string)[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: ReactNode
  searchPlaceholder?: string
  /** Shown when the search matches nothing */
  emptyText?: ReactNode
  label?: ReactNode
  hint?: ReactNode
  /** Marks the select invalid and replaces the hint */
  error?: ReactNode
  disabled?: boolean
  /** Submits the value with a form under this name */
  name?: string
  id?: string
  defaultOpen?: boolean
  /** The side of the trigger the list opens on */
  side?: 'bottom' | 'top'
  /** Names the select when it has no visible label */
  'aria-label'?: string
  className?: string
}

// The combobox's own items are the options' values, in groups when the list shows any
type ItemGroup = {
  value: string
  label?: ReactNode
  items: string[]
}

/*
  A `Select` with a search: shadcn's combobox, which is Base UI's, with the input inside the popup.
  The trigger is dressed as `Select`'s, its value cut short on one line, and opens a search field
  over the options, in groups when it has any, the picked one checked. A pick closes the list, and
  the search starts empty each time it opens. With a label, hint or error it renders a Field
  around itself, and `className` goes to the Field
*/
function Combobox({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  label,
  hint,
  error,
  disabled = false,
  name,
  id,
  defaultOpen = false,
  side = 'bottom',
  'aria-label': ariaLabel,
  className,
}: Props) {
  const autoId = useId()
  const triggerId = id ?? autoId
  // Base UI's id for a Combobox.Label under a root with this id, which also names the popup
  const labelId = `${triggerId}-label`
  const messageId = `${triggerId}-message`
  const hasField = !!(label || hint || error)
  const [innerValue, setInnerValue] = useState(defaultValue ?? null)
  const [open, setOpen] = useState(defaultOpen)
  const currentValue = value ?? innerValue
  const { portalContainerRef, findPortalContainer } = useComboboxLayer(open)
  const { contains } = ComboboxPrimitive.useFilter()

  const groups = toComboboxGroups(options)
  const allOptions = groups.flatMap(group => group.options)
  const optionsByValue = new Map(allOptions.map(option => [option.value, option]))
  const isGrouped = groups.length > 1 || groups.some(group => group.label)
  const itemGroups: ItemGroup[] = groups.map((group, index) => ({
    value: String(index),
    label: group.label,
    items: group.options.map(option => option.value),
  }))
  const items = isGrouped ? itemGroups : allOptions.map(option => option.value)
  // A value no option carries still shows, as itself
  const selectedOption =
    currentValue === null ? null : (optionsByValue.get(currentValue) ?? { value: currentValue, label: currentValue })

  function handleValueChange(nextValue: string | null) {
    // A single select keeps its pick: picking it again leaves it picked
    if (nextValue === null) return
    if (value === undefined) setInnerValue(nextValue)

    onValueChange?.(nextValue)
  }

  function filterItem(itemValue: string, query: string) {
    const option = optionsByValue.get(itemValue)

    return option ? getComboboxSearchTexts(option).some(text => contains(text, query)) : false
  }

  function renderItem(itemValue: string) {
    const option = optionsByValue.get(itemValue)

    return (
      <ComboboxPrimitive.Item
        key={itemValue}
        value={itemValue}
        disabled={option?.disabled}
        className="relative flex min-h-8 cursor-pointer items-center gap-2 rounded-xs py-0 pr-8 pl-2 text-sm text-foreground outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-neutral-100 data-highlighted:text-secondary data-selected:font-medium data-selected:text-secondary"
      >
        <span className="min-w-0 flex-1 truncate">{option?.label}</span>
        <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center text-primary">
          <CheckIcon className="size-4" />
        </ComboboxPrimitive.ItemIndicator>
      </ComboboxPrimitive.Item>
    )
  }

  const control = (
    <ComboboxPrimitive.Trigger
      ref={findPortalContainer}
      data-slot="combobox-trigger"
      aria-label={ariaLabel}
      aria-invalid={error ? true : undefined}
      aria-describedby={hint || error ? messageId : undefined}
      className={cn(
        inputClassName,
        'group flex cursor-pointer items-center justify-between gap-2 text-left data-disabled:cursor-not-allowed data-disabled:opacity-50 data-popup-open:border-secondary data-popup-open:bg-white',
        !hasField && className,
      )}
    >
      <span className={cn('min-w-0 flex-1 truncate', !selectedOption && 'text-muted-foreground')}>
        {selectedOption ? selectedOption.label : placeholder}
      </span>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-data-popup-open:rotate-180" />
    </ComboboxPrimitive.Trigger>
  )

  return (
    <ComboboxPrimitive.Root
      autoHighlight
      id={triggerId}
      items={items}
      filter={filterItem}
      value={currentValue}
      onValueChange={handleValueChange}
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
          {label ? <ComboboxPrimitive.Label className={fieldLabelClassName}>{label}</ComboboxPrimitive.Label> : null}
          {control}
        </Field>
      ) : (
        control
      )}
      {/* Boxless, so it takes no row in a dialog's grid */}
      <ComboboxPrimitive.Portal
        container={portalContainerRef}
        className="contents"
      >
        <ComboboxPrimitive.Positioner
          side={side}
          sideOffset={4}
          align="start"
          className="z-50 outline-none"
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
            className="flex max-h-(--available-height) w-(--anchor-width) flex-col overflow-hidden rounded-xs border border-border bg-popover font-sans text-popover-foreground shadow-md outline-none duration-150 ease-out data-open:animate-in data-open:fade-in-0 data-[side=bottom]:slide-in-from-top-[2px] data-[side=top]:slide-in-from-bottom-[2px]"
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 text-muted-foreground">
              <SearchIcon className="size-4 shrink-0" />
              <ComboboxPrimitive.Input
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                spellCheck={false}
                // 16px on a touch screen, as `Input` is, or iOS zooms into it
                className="h-full min-w-0 flex-1 bg-transparent p-0 font-sans text-sm pointer-coarse:text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ComboboxPrimitive.Empty className="px-2 text-center text-sm text-muted-foreground not-empty:py-5">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-60 min-h-0 scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
              {isGrouped
                ? (group: ItemGroup, index: number) => (
                    <Fragment key={group.value}>
                      {index > 0 ? <ComboboxPrimitive.Separator className="-mx-1 my-1 h-px bg-border" /> : null}
                      <ComboboxPrimitive.Group items={group.items}>
                        {group.label ? (
                          <ComboboxPrimitive.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            {group.label}
                          </ComboboxPrimitive.GroupLabel>
                        ) : null}
                        <ComboboxPrimitive.Collection>{renderItem}</ComboboxPrimitive.Collection>
                      </ComboboxPrimitive.Group>
                    </Fragment>
                  )
                : renderItem}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
