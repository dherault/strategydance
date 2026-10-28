import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useRestoreDeletedBill from '~hooks/budget/useRestoreDeletedBill'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The bill the row's call deleted
  billId: string
}

/*
  Restore, on the row of a bill Strategy Dance deleted, which the thread offers while the
  organization's bills no longer hold it and a day has not passed since the call: the Bills tab's
  own restore, its receipt coming back with it. Once restored, the live bills hold it again and the
  thread takes the button away
*/
function ConversationBillRestore({ billId }: Props) {
  const { formatMessage } = useIntl()
  const restoreDeletedBill = useRestoreDeletedBill()
  const [isRestoring, setIsRestoring] = useState(false)

  async function handleRestore() {
    setIsRestoring(true)

    try {
      await restoreDeletedBill(billId)
    } catch (error) {
      console.error('Failed to restore a bill', error)
      toast.error(formatMessage(conversationMessages.restoreBillError))
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Button
      variant="transparent"
      size="sm"
      className="max-sm:px-2"
      disabled={isRestoring}
      onClick={handleRestore}
    >
      {formatMessage(conversationMessages.restoreBill)}
    </Button>
  )
}

export default ConversationBillRestore
