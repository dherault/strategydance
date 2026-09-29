import type { PropsWithChildren } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

type Props = PropsWithChildren<{
  // What the button that opens it names in `aria-controls`
  id: string
  isShown: boolean
}>

/*
  A panel under the support card's buttons. It opens by growing its grid row from nothing to its
  content's height, fading in as it does. Closed, it is inert, so what it holds leaves the tab
  order and the accessibility tree as it leaves the screen
*/
function SupportReveal({ id, isShown, children }: Props) {
  return (
    <div
      id={id}
      inert={!isShown}
      className={cn(
        'grid w-full grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-150 ease-in-out motion-reduce:transition-none',
        isShown && 'grid-rows-[1fr] opacity-100',
      )}
    >
      <div className="overflow-hidden">
        <div className="pt-2">{children}</div>
      </div>
    </div>
  )
}

export default SupportReveal
