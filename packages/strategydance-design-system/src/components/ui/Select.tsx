import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import { type ReactNode, useId } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import { Field } from 'strategydance-design-system/components/ui/Field'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'

type SelectOption = {
  /** Any string but the empty one, which Radix reserves for clearing the selection */
  value: string
  label: ReactNode
  disabled?: boolean
}

type SelectGroup = {
  label?: ReactNode
  options: (SelectOption | string)[]
}

type Props = {
  /** Options, as strings or objects, or groups of them, which get a label and separators */
  options: (SelectOption | SelectGroup | string)[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: ReactNode
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

function toOption(option: SelectOption | string): SelectOption {
  return typeof option === 'string' ? { value: option, label: option } : option
}

function isGroup(option: SelectOption | SelectGroup | string): option is SelectGroup {
  return typeof option === 'object' && 'options' in option
}

function SelectItem({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled}
      className="relative flex min-h-8 cursor-pointer items-center gap-2 rounded-xs py-0 pr-8 pl-2 text-sm text-foreground outline-none select-none data-highlighted:bg-neutral-100 data-highlighted:text-secondary data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[state=checked]:font-medium data-[state=checked]:text-secondary"
    >
      <SelectPrimitive.ItemText>
        {option.label}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center text-primary">
        <CheckIcon className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

/*
  A listbox dressed as an Input, with keyboard navigation and typeahead from Radix. With a label,
  hint or error it renders a Field around itself, and `className` goes to the Field
*/
function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  label,
  hint,
  error,
  disabled,
  name,
  id,
  defaultOpen,
  side = 'bottom',
  'aria-label': ariaLabel,
  className,
}: Props) {
  const autoId = useId()
  const triggerId = id ?? autoId
  const messageId = `${triggerId}-message`
  const hasField = !!(label || hint || error)

  const control = (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
      defaultOpen={defaultOpen}
    >
      <SelectPrimitive.Trigger
        id={triggerId}
        data-slot="select-trigger"
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? messageId : undefined}
        className={cn(
          inputClassName,
          'group flex cursor-pointer items-center justify-between gap-2 text-left data-placeholder:text-muted-foreground data-[state=open]:border-secondary data-[state=open]:bg-white [&>span]:truncate',
          !hasField && className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          side={side}
          sideOffset={4}
          className="z-50 max-h-[min(280px,var(--radix-select-content-available-height))] w-(--radix-select-trigger-width) overflow-hidden rounded-xs border border-border bg-popover font-sans shadow-md duration-150 ease-out data-[side=bottom]:slide-in-from-top-[2px] data-[side=top]:slide-in-from-bottom-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option, index) => isGroup(option)
              ? (
                  <SelectPrimitive.Group key={index}>
                    {index > 0
                      ? <SelectPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />
                      : null}
                    {option.label
                      ? (
                          <SelectPrimitive.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            {option.label}
                          </SelectPrimitive.Label>
                        )
                      : null}
                    {option.options.map(toOption).map(groupOption => (
                      <SelectItem
                        key={groupOption.value}
                        option={groupOption}
                      />
                    ))}
                  </SelectPrimitive.Group>
                )
              : (
                  <SelectItem
                    key={toOption(option).value}
                    option={toOption(option)}
                  />
                ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )

  if (!hasField) return control

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={triggerId}
      messageId={messageId}
      className={className}
    >
      {control}
    </Field>
  )
}

export { Select }
export type { SelectGroup, SelectOption }
