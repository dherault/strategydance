import { type ComponentProps, type ReactNode, useId } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'

import { cn } from 'strategydance-design-system/lib/utils'

import { Field } from 'strategydance-design-system/components/ui/Field'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'
import { Popover, PopoverContent, PopoverTrigger } from 'strategydance-design-system/components/ui/Popover'

const SHORT_HEX_PATTERN = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i

// Six uppercase hex digits after a `#`, whatever the picker or the field handed over: the pickers
// write lowercase, and the field lets somebody type three digits
function normalizeHex(hex: string) {
  const short = SHORT_HEX_PATTERN.exec(hex)
  const long = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : hex

  return (long.startsWith('#') ? long : `#${long}`).toUpperCase()
}

type Props = Omit<ComponentProps<'button'>, 'value' | 'onChange' | 'children'> & {
  /** A `#RRGGBB` color */
  value: string
  /** Called with six uppercase hex digits after a `#` */
  onChange: (value: string) => void
  label?: ReactNode
  hint?: ReactNode
  /** Marks the trigger invalid and replaces the hint */
  error?: ReactNode
  /** The hex field's accessible name. Defaults to "Hex color" */
  hexLabel?: string
  /** Where the picker opens. Defaults to top, for a field near the bottom of a card */
  side?: 'top' | 'bottom'
  defaultOpen?: boolean
}

/*
  A color field: a trigger dressed as an input, with a swatch and the hex code, that opens a
  saturation square, a hue slider and a hex field in a popover. Every change is applied as it
  happens, so there is nothing to confirm.

  The square and the slider are react-colorful's, which names them "Color" and "Hue" in English
  and takes no label of its own. The hex field is the way in that reads in every language, and is
  labeled by `hexLabel`.

  With a label, hint or error it renders a Field around itself, and `className` goes to the Field,
  as Input does
*/
function ColorPicker({
  value,
  onChange,
  label,
  hint,
  error,
  hexLabel = 'Hex color',
  side = 'top',
  defaultOpen,
  id,
  className,
  disabled,
  ...props
}: Props) {
  const autoId = useId()
  const triggerId = id ?? autoId
  const messageId = `${triggerId}-message`
  const hasField = !!(label || hint || error)
  const color = normalizeHex(value)

  function handleChange(hex: string) {
    onChange(normalizeHex(hex))
  }

  const picker = (
    <Popover defaultOpen={defaultOpen}>
      <PopoverTrigger asChild>
        <button
          id={triggerId}
          type="button"
          data-slot="color-picker"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? messageId : undefined}
          className={cn(
            inputClassName,
            'flex cursor-pointer items-center gap-2.5 text-left hover:border-neutral-300 data-[state=open]:border-secondary data-[state=open]:bg-white',
            !hasField && className,
          )}
          {...props}
        >
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded-xs shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
            style={{ backgroundColor: color }}
          />
          <span className="tabular-nums">
            {color}
          </span>
        </button>
      </PopoverTrigger>
      {/*
        react-colorful injects its own stylesheet, unlayered, which beats anything in Tailwind's
        layers whatever its specificity: hence the `!` on every override of it. Its class names
        carry `__`, which Tailwind reads as spaces unless escaped
      */}
      <PopoverContent
        side={side}
        className="grid w-60 gap-3 p-3 [&_.react-colorful]:h-auto! [&_.react-colorful]:w-full! [&_.react-colorful]:gap-3! [&_.react-colorful\_\_saturation]:h-40! [&_.react-colorful\_\_saturation]:flex-none! [&_.react-colorful\_\_saturation]:rounded-xs! [&_.react-colorful\_\_saturation]:border-b-0! [&_.react-colorful\_\_hue]:h-3! [&_.react-colorful\_\_hue]:flex-none! [&_.react-colorful\_\_last-control]:rounded-xs! [&_.react-colorful\_\_pointer]:size-4!"
      >
        <HexColorPicker
          color={color}
          onChange={handleChange}
        />
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-8 shrink-0 rounded-xs shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
            style={{ backgroundColor: color }}
          />
          <HexColorInput
            color={color}
            onChange={handleChange}
            prefixed
            aria-label={hexLabel}
            className={cn(inputClassName, 'h-8 uppercase tabular-nums')}
          />
        </div>
      </PopoverContent>
    </Popover>
  )

  if (!hasField) return picker

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={triggerId}
      messageId={messageId}
      className={className}
    >
      {picker}
    </Field>
  )
}

export { ColorPicker }
