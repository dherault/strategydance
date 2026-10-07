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

  The column, gutters and all, is a `page-column`, as `ContainerLayout`'s is, with its own width:
  centered on the screen, with the sidebar's width clear on its right. From `md` the gutters are
  the gap it keeps from the sidebar, and mirrors on its right, so it takes no other
*/
function KnowledgeDocumentLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className="page-column box-border pt-5 pb-16 [--page-column-max-width:884px] md:px-[58px] md:[--page-column-gutter:0px]">
      <div
        className={cn('flex min-w-0 flex-col gap-6', className)}
        {...props}
      />
    </div>
  )
}

export default KnowledgeDocumentLayout
