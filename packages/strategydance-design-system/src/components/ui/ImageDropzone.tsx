import { ImageIcon } from 'lucide-react'
import { type ComponentProps, type DragEvent, type KeyboardEvent, type ReactNode, useRef, useState } from 'react'
import { Spinner } from 'strategydance-design-system/components/ui/Spinner'
import { cn } from 'strategydance-design-system/lib/utils'

type Shape = 'wide' | 'square' | 'circle'

// The zone's proportions for each shape
const ZONE_CLASS_NAMES: Record<Shape, string> = {
  wide: 'aspect-[4/1]',
  square: 'mx-auto aspect-square max-w-[200px]',
  circle: 'mx-auto aspect-square max-w-[200px] rounded-full',
}

type Props = Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'onDrop'> & {
  /**
   * Wide is 4:1, as a banner; square is 1:1, as a logo, on white for one with transparent parts;
   * circle is round, as an avatar. Each preview is cropped to fill the zone, as the picture is
   * wherever it is shown
   */
  shape?: Shape
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
  /** While a picture is being saved: the preview dims under a spinner, and the zone takes no file */
  busy?: boolean
  /** The spinner's accessible name */
  busyLabel?: string
}

/*
  Where a picture is chosen: a dashed zone that opens the file picker on a click, Enter or Space,
  and takes a file dragged onto it. It previews whatever `src` it is given, and hands over the file
  and nothing more, since what a caller accepts varies. A caller that saves the file at once says
  so with `busy` until it has
*/
function ImageDropzone({
  shape = 'wide',
  src,
  alt = '',
  label,
  prompt = (
    <>
      <strong>Choose a file</strong> or drag it here
    </>
  ),
  accept = 'image/*',
  onFileSelect,
  disabled = false,
  busy = false,
  busyLabel = 'Saving',
  className,
  ...props
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)

  const isInert = disabled || busy

  function openPicker() {
    if (!isInert) inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    openPicker()
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()

    if (!isInert) setIsDragging(true)
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

    if (file && !isInert) onFileSelect(file)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-slot="image-dropzone"
      data-dragging={isDragging || undefined}
      aria-busy={busy || undefined}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative grid w-full cursor-pointer place-items-center overflow-hidden rounded-xs border border-dashed border-neutral-300 bg-neutral-50 font-sans transition-[border-color,background-color] duration-150 ease-in-out outline-none hover:border-primary hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary data-dragging:border-primary data-dragging:bg-primary-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-busy:cursor-progress',
        ZONE_CLASS_NAMES[shape],
        className,
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            'absolute inset-0 size-full object-cover',
            shape === 'square' && 'bg-white',
            busy && 'opacity-50',
          )}
        />
      ) : busy ? null : (
        <div className="flex w-full flex-col items-center gap-1.5 p-4 text-center text-sm text-neutral-500 [&_strong]:font-medium [&_strong]:text-primary">
          <ImageIcon
            aria-hidden="true"
            className="size-6"
          />
          <span>{prompt}</span>
        </div>
      )}
      {busy ? (
        // On a white disc, which reads over any picture, and positioned so it sits over the preview
        <span className="relative grid place-items-center rounded-full bg-white p-2 shadow-sm">
          <Spinner
            size="lg"
            aria-label={busyLabel}
          />
        </span>
      ) : null}
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
