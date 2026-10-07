import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The column a page is laid out in: at most 1280px wide, with the same gutters everywhere, so a
  page does not jump as the sidebar switches to another. Its children stack, and the gap between
  them is the page's own, passed through `className`.

  `page-column`, in `styles.css`, sizes and places it beside the sidebar: centered on the screen,
  with the sidebar's width clear on its right, as the design has it
*/
function ContainerLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('page-column flex flex-col pt-6 pb-12', className)}
      {...props}
    />
  )
}

export default ContainerLayout
