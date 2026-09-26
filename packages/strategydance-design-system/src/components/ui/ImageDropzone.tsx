import { ImageIcon } from 'lucide-react'
import { type ComponentProps, type DragEvent, type KeyboardEvent, type ReactNode, useRef, useState } from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

type Props = Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'onDrop'> & {
  /** Wide is 4:1 and covers the zone, as a banner; square is 1:1 and fits inside it, as a logo */
  shape?: 'wide' | 'square'
  /** The image to preview, or nothing for the empty prompt */
  src?: string | null
  /** The preview's alternative text */
  alt?: string
  /** The zone's accessible name, such as "Choose a logo" */
  label: string
  /** What the empty zone says. A `<strong>` in it takes the primary color */
  prompt?: ReactNode
  /** The file input's `accept` */
  accept?: string
  /** Called with the file chosen or dropped. Checking its type and size is the caller's to do */
  onFileSelect: (file: File) => void
  disabled?: boolean
}

/*
  Where a picture is chosen: a dashed zone that opens the file picker on a click, Enter or Space,
  and takes a file dragged onto it. It previews whatever `src` it is given, and hands over the file
  and nothing more, since what a caller accepts varies
*/
function ImageDropzone({
  shape = 'wide',
  src,
  alt = '',
  label,
  prompt = (
    <>
      <strong>Choose a file</strong>
      {' '}
      or drag it here
    </>
  ),
  accept = 'image/*',
  onFileSelect,
  disabled = false,
  className,
  ...props
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)

  function openPicker() {
    if (!disabled) inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    openPicker()
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()

    if (!disabled) setIsDragging(true)
  }

  // Moving between the zone and the preview inside it fires a leave too, which is not one
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return

    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]

    if (file && !disabled) onFileSelect(file)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-slot="image-dropzone"
      data-dragging={isDragging || undefined}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative grid w-full cursor-pointer place-items-center overflow-hidden rounded-xs border border-dashed border-neutral-300 bg-neutral-50 font-sans transition-[border-color,background-color] duration-150 ease-in-out outline-none hover:border-primary hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary data-dragging:border-primary data-dragging:bg-primary-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        shape === 'wide' ? 'aspect-[4/1]' : 'mx-auto aspect-square max-w-[200px]',
        className,
      )}
      {...props}
    >
      {src
        ? (
            <img
              src={src}
              alt={alt}
              className={cn('absolute inset-0 size-full', shape === 'wide' ? 'object-cover' : 'bg-white object-contain')}
            />
          )
        : (
            <div className="flex w-full flex-col items-center gap-1.5 p-4 text-center text-sm text-neutral-500 [&_strong]:font-medium [&_strong]:text-primary">
              <ImageIcon
                aria-hidden="true"
                className="size-6"
              />
              <span>
                {prompt}
              </span>
            </div>
          )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        onChange={event => {
          const file = event.target.files?.[0]

          // Cleared, so choosing the same file again still fires a change
          event.target.value = ''

          if (file) onFileSelect(file)
        }}
      />
    </div>
  )
}

export { ImageDropzone }
