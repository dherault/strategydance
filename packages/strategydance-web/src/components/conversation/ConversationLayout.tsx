import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The column a conversation's page is laid out in, 768px at most, as the design has it. It centers
  on the window as `KnowledgeDocumentLayout`'s does, with its own width in the margin: once there is
  room for it and a sidebar's width to its right, the margin grows by half of whatever is left over,
  and short of that it sits against the sidebar
*/
function ConversationLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className="ml-[max(0px,calc((100%-768px-var(--sidebar-width))/2))] box-border w-full max-w-[768px] px-2 pt-5">
      <div
        className={cn('flex min-w-0 flex-col gap-4', className)}
        {...props}
      />
    </div>
  )
}

export default ConversationLayout
