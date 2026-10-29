import { ChevronRightIcon } from 'lucide-react'
import { type ReactNode, useId } from 'react'
import { Dialog, DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'

type Props = {
  title: ReactNode
  // One short line under the title, left out when the panel is empty
  description?: ReactNode
  // The dialog's content, which shows everything the panel shows the start of
  dialog: ReactNode
  children: ReactNode
}

/*
  One of the Expenses tab's two panels, a card that opens a dialog listing all of what it shows the
  start of. Its heading holds the button, stretched over the whole card, since a heading cannot sit
  inside a button, and a card that were a button would hide its list from a screen reader. The
  chevron turns primary as the card is hovered. Side by side, the cards reach past the page's edge
  by their padding, so their text lines up with it; stacked, on a phone's narrower gutter, they
  keep within it
*/
function BudgetPanel({ title, description, dialog, children }: Props) {
  const titleId = useId()

  return (
    <Dialog>
      <section
        aria-labelledby={titleId}
        className="group/panel relative flex min-w-0 flex-col gap-3 rounded-xs p-4 transition-colors duration-150 ease-in-out hover:bg-neutral-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-secondary @max-[760px]:px-0 @max-[760px]:hover:bg-transparent"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id={titleId}
              className="m-0 text-2xl leading-[1.15]"
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-left [font:inherit] text-inherit outline-none after:absolute after:inset-0 after:content-['']"
                >
                  {title}
                </button>
              </DialogTrigger>
            </h2>
            {description ? <p className="m-0 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-neutral-400 transition-colors duration-150 ease-in-out group-hover/panel:text-primary"
          />
        </div>
        {children}
      </section>
      {dialog}
    </Dialog>
  )
}

export default BudgetPanel
