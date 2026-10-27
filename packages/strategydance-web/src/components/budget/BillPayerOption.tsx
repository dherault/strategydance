import { useIntl } from 'react-intl'

import type { BillPayer } from '~types'

import BillPayerAvatar from '~components/budget/BillPayerAvatar'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  payer: BillPayer
}

/*
  A payer as a choice of a list, the filter by payer's or the bill dialog's: their face and their
  name, the reader's own followed by "- me", and one who left with no name a former member
*/
function BillPayerOption({ payer }: Props) {
  const { formatMessage } = useIntl()

  const name = payer.name ?? formatMessage(budgetMessages.formerMember)

  return (
    <span className="flex min-w-0 items-center gap-2">
      <BillPayerAvatar payer={payer} />
      <span className="truncate">{payer.isViewer ? formatMessage(budgetMessages.memberYou, { name }) : name}</span>
    </span>
  )
}

export default BillPayerOption
