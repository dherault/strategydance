import { useIntl } from 'react-intl'

import globalMessages from '~data/intl/messages/global'

type Props = {
  source: string
}

// Mounted by a waiter, so it renders before its own catalogue has loaded and shows the English
// defaultMessage on the first paint of a fresh session. That is the right trade: the alternative is
// a spinner that announces nothing at all
function Loading({ source }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div
      role="status"
      aria-label={formatMessage(globalMessages.loading)}
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-white"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
      {import.meta.env.DEV && (
        <div className="text-xs text-neutral-500">
          {source}
        </div>
      )}
    </div>
  )
}

export default Loading
