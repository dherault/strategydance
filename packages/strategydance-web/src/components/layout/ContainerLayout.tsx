import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The column a page is laid out in: at most 1024px wide, with the same gutters everywhere, so a
  page does not jump as the sidebar switches to another. Its children stack, and the gap between
  them is the page's own, passed through `className`.

  Beside the sidebar it centers on the window rather than on the space left of it, as the design
  has it: once there is room for the column and a sidebar's width to its right, the margin grows
  by half of whatever is left over. Short of that it sits against the sidebar, full width. The
  margin is only positive once the column is already capped at 1024px, so `w-full` and the margin
  never add up past the parent.

  `--sidebar-width` is set by `SidebarProvider`. Outside it, as on the invitation page, the
  declaration is invalid at computed-value time and the margin falls back to 0
*/
function ContainerLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('ml-[max(0px,calc((100%-1024px-var(--sidebar-width))/2))] flex w-full max-w-[1024px] flex-col px-2 pt-6 pb-12', className)}
      {...props}
    />
  )
}

export default ContainerLayout
