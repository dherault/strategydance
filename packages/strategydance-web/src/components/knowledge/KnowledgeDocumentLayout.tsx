import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

/*
  The column a document's page is laid out in, at a length of line a page of text reads well at.

  A gutter on either side is as wide as the editor's side menu, its 52px and the 6px between it and
  the text that `RichTextEditor.css` leaves. The menu shows in the left one when a block is hovered,
  and the right one mirrors it, so the text, the title over it and the rule between them sit in the
  middle of the column whether the menu shows or not. A phone has no room for them, so below `md`
  the column runs nearly to the screen's edges and the editor keeps a gutter of its own on the
  left, where a tap on a block shows its menu.

  The column, gutters and all, centers on the window as `ContainerLayout`'s does, with its own
  width in the margin: once there is room for it and a sidebar's width to its right, the margin
  grows by half of whatever is left over, and short of that it sits against the sidebar
*/
function KnowledgeDocumentLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className="ml-[max(0px,calc((100%-884px-var(--sidebar-width))/2))] box-border w-full max-w-[884px] px-2 pt-5 pb-16 md:px-[58px]">
      <div
        className={cn('flex min-w-0 flex-col gap-6', className)}
        {...props}
      />
    </div>
  )
}

export default KnowledgeDocumentLayout
