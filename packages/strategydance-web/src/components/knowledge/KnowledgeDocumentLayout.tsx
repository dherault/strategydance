import type { ComponentProps } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import ContainerLayout from '~components/layout/ContainerLayout'

/*
  The column a document's page is laid out in: the page's own column, centered on the window as
  every page's is, and a narrower one inside it, at a length of line a page of text reads well at
*/
function KnowledgeDocumentLayout({ className, ...props }: ComponentProps<'div'>) {
  return (
    <ContainerLayout className="pt-5 pb-16">
      <div
        className={cn('mx-auto flex w-full max-w-[768px] min-w-0 flex-col gap-6', className)}
        {...props}
      />
    </ContainerLayout>
  )
}

export default KnowledgeDocumentLayout
