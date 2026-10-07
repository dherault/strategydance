import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The column a conversation's page is laid out in, 768px at most, as the design has it. It is a
  `page-column`, as `ContainerLayout`'s is, with its own width: centered on the screen, with the
  sidebar's width clear on its right
*/
function ConversationLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className="page-column box-border pt-5 [--page-column-max-width:768px]">
      <div
        className={cn('flex min-w-0 flex-col gap-4', className)}
        {...props}
      />
    </div>
  )
}

export default ConversationLayout
