import { type ComponentProps, type ReactNode, useId, useState } from 'react'
import TextareaAutosize, { type TextareaAutosizeProps } from 'react-textarea-autosize'
import { Field } from 'strategydance-design-system/components/ui/Field'
import { inputClassName } from 'strategydance-design-system/components/ui/Input'
import useFontLoaded from 'strategydance-design-system/hooks/useFontLoaded'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = Omit<ComponentProps<'textarea'>, 'style'> & {
  label?: ReactNode
  hint?: ReactNode
  /** Marks the textarea invalid and replaces the hint */
  error?: ReactNode
  /** Grows with what is typed, from `rows` lines, instead of being dragged taller */
  autosize?: boolean
  /** With `autosize`, the most lines it grows to before it scrolls */
  maxRows?: number
  // What an autosizing textarea accepts, since it sets its own height: no min or max height, and
  // a height in pixels
  style?: TextareaAutosizeProps['style']
}

/*
  An Input over several lines: the same border, fill and focus, from the class the two share. Its
  height comes from its rows rather than the input's fixed 40px, and the reader can drag it taller.

  With `autosize` it grows with its content instead, through react-textarea-autosize, starting at
  its rows. The drag handle and the minimum height go, since its height is the content's. It
  measures again once its font has loaded, which react-textarea-autosize misses in WebKit, so a
  text in a display font does not keep the height its wider fallback wrapped to.

  With a label, hint or error it renders a Field around itself, and `className` goes to the Field
*/
function Textarea({ label, hint, error, id, className, autosize, rows, maxRows, ref, ...props }: Props) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const messageId = `${textareaId}-message`
  const hasField = !!(label || hint || error)
  const [autosized, setAutosized] = useState<HTMLTextAreaElement | null>(null)
  const isFontLoaded = useFontLoaded(autosized)

  // Keeps the autosizing textarea to wait for its font, and hands it on to the caller's ref, with
  // the cleanup a callback ref may return
  function setAutosizedRef(element: HTMLTextAreaElement | null) {
    setAutosized(element)

    if (typeof ref === 'function') return ref(element)
    if (ref) ref.current = element
  }

  const sharedProps = {
    id: textareaId,
    'data-slot': 'textarea',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': hint || error ? messageId : undefined,
  }

  const textarea = autosize ? (
    <TextareaAutosize
      {...sharedProps}
      ref={setAutosizedRef}
      minRows={rows}
      maxRows={maxRows}
      className={cn(inputClassName, 'block h-auto resize-none py-2.5 leading-normal', !hasField && className)}
      // A changed prop renders it again, and it measures on every render
      data-font-loaded={isFontLoaded || undefined}
      {...props}
    />
  ) : (
    <textarea
      {...sharedProps}
      ref={ref}
      rows={rows}
      className={cn(inputClassName, 'block h-auto min-h-32 resize-y py-2.5 leading-normal', !hasField && className)}
      {...props}
    />
  )

  if (!hasField) return textarea

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={textareaId}
      messageId={messageId}
      className={className}
    >
      {textarea}
    </Field>
  )
}

export { Textarea }
