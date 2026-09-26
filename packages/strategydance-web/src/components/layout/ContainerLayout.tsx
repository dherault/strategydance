import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The column a page is laid out in: at most 1024px wide, beside the sidebar, with the same gutters
  everywhere, so a page does not jump as the sidebar switches to another. Its children stack, and
  the gap between them is the page's own, passed through `className`
*/
function ContainerLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex w-full max-w-[1024px] flex-col px-2 pt-5 pb-12', className)}
      {...props}
    />
  )
}

export default ContainerLayout
