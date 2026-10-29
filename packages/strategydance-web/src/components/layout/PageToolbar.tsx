import type { ReactNode } from 'react'

type Props = {
  // The filters, laid from the left
  children?: ReactNode
  // Laid at the far right, at the height of the fields beside them
  actions?: ReactNode
}

/*
  The row over a page's content, as the board's and the documents', with its actions at the far
  right whether or not it has filters. Whatever does not fit wraps: the actions under the filters,
  still on the right, and under one another once the row is too narrow for them side by side
*/
function PageToolbar({ children, actions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {actions ? (
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

export default PageToolbar
