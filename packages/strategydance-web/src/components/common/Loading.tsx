import { useIntl } from 'react-intl'
import { Spinner } from 'strategydance-design-system/components/ui/Spinner'

import globalMessages from '~data/intl/messages/global'

type Props = {
  source: string
}

/*
  Mounted by a waiter, so it renders before its own catalogue has loaded and shows the English
  defaultMessage on the first paint of a fresh session. That is the right trade: the
  alternative is a spinner that announces nothing at all
*/
function Loading({ source }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div
      role="status"
      aria-label={formatMessage(globalMessages.loading)}
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-background"
    >
      <Spinner
        size="xl"
        aria-hidden="true"
      />
      {import.meta.env.DEV && (
        <div className="text-xs text-muted-foreground">
          {source}
        </div>
      )}
    </div>
  )
}

export default Loading
