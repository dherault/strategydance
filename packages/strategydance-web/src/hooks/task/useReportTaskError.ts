import { useIntl } from 'react-intl'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import taskMessages from '~data/intl/messages/task'

// Says so when a change to a task did not go through. The board is read again by then, so what
// the reader sees is what the server has
function useReportTaskError() {
  const { formatMessage } = useIntl()

  return async function report(write: Promise<unknown>) {
    try {
      await write
    } catch (error) {
      console.error('Failed to save a change to a task', error)

      toast.error(formatMessage(taskMessages.saveError))
    }
  }
}

export default useReportTaskError
