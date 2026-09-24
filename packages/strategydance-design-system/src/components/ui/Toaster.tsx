import {
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import type { ComponentProps } from 'react'
import { Toaster as Sonner, toast } from 'sonner'

const buttonClassName = 'h-6 shrink-0 cursor-pointer rounded-xs border-0 px-2 font-sans text-xs leading-none font-medium transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'

/*
  Rich colours tint a toast by its type, and only when the toaster or the toast asks for them.
  Sonner keeps its own rich palette even when unstyled, behind a three-attribute selector no
  utility outranks, hence the `!`
*/
const richClassNames = {
  success: 'data-[rich-colors=true]:border-green-200! data-[rich-colors=true]:bg-success-bg! data-[rich-colors=true]:text-green-800!',
  info: 'data-[rich-colors=true]:border-primary-200! data-[rich-colors=true]:bg-primary-50! data-[rich-colors=true]:text-primary-800!',
  warning: 'data-[rich-colors=true]:border-amber-200! data-[rich-colors=true]:bg-warning-bg! data-[rich-colors=true]:text-amber-800!',
  error: 'data-[rich-colors=true]:border-red-200! data-[rich-colors=true]:bg-danger-bg! data-[rich-colors=true]:text-red-700!',
}

type Props = ComponentProps<typeof Sonner>

/*
  Mount it once, near the root, and raise toasts from anywhere with `toast()`. Sonner does the
  queueing, stacking, swiping and timing; its own look is switched off so the design's applies
*/
function Toaster({ toastOptions, ...props }: Props) {
  return (
    <Sonner
      icons={{
        success: <CircleCheckIcon />,
        info: <InfoIcon />,
        warning: <TriangleAlertIcon />,
        error: <OctagonXIcon />,
        loading: <LoaderCircleIcon className="animate-spin" />,
        close: <XIcon />,
      }}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: {
          toast: 'box-border flex w-(--width) items-center gap-1.5 rounded-xs border border-border bg-white p-4 font-sans text-[13px] leading-normal text-secondary shadow-xs antialiased',
          // Relative, because Sonner centres its loader absolutely inside the icon
          icon: 'relative mr-1 -ml-[3px] flex size-4 shrink-0 items-center [&_svg]:size-4',
          content: 'flex min-w-0 flex-1 flex-col gap-0.5',
          title: 'font-medium',
          description: 'text-pretty text-muted-foreground in-data-[rich-colors=true]:text-inherit',
          actionButton: `${buttonClassName} bg-primary text-primary-foreground hover:bg-primary-800`,
          cancelButton: `${buttonClassName} bg-neutral-100 text-foreground hover:bg-neutral-200`,
          closeButton: 'absolute top-0 left-0 z-1 grid size-5 -translate-x-[35%] -translate-y-[35%] cursor-pointer place-items-center rounded-full border border-border bg-white p-0 text-foreground transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary [&_svg]:size-3',
          ...richClassNames,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
