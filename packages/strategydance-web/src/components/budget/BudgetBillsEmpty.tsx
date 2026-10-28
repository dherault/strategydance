import { PlusIcon, ReceiptIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import BillUploadDialog from '~components/budget/BillUploadDialog'

import budgetMessages from '~data/intl/messages/budget'

// The Bills tab with no bill, and the way to add the first
function BudgetBillsEmpty() {
  const { formatMessage } = useIntl()

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <ReceiptIcon />
        </EmptyMedia>
        <EmptyTitle>{formatMessage(budgetMessages.billsEmptyTitle)}</EmptyTitle>
        <EmptyDescription>{formatMessage(budgetMessages.billsEmptyText)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <BillUploadDialog>
          <DialogTrigger asChild>
            <Button
              size="sm"
              icon={<PlusIcon />}
            >
              {formatMessage(budgetMessages.newBill)}
            </Button>
          </DialogTrigger>
        </BillUploadDialog>
      </EmptyContent>
    </Empty>
  )
}

export default BudgetBillsEmpty
