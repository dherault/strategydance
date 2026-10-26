import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import getBudgetBarSegments, { type BudgetBarSegmentKind } from '~utils/budget/getBudgetBarSegments'

import budgetMessages from '~data/intl/messages/budget'

// Spent and expected are blue up to the limit, red past it
const SEGMENT_CLASS_NAMES: Record<BudgetBarSegmentKind, string> = {
  spent: 'bg-primary',
  over: 'bg-danger',
  expected: 'bg-primary-200',
  expectedOver: 'bg-red-200',
}

type Props = {
  spent: number
  // What is still expected, or null for a stat whose bar shows what was spent alone
  expected: number | null
  limit: number
}

/*
  A stat's share of its limit: what was spent, then what is still expected, each blue up to the
  limit and red past it. Past 100% the bar spans the whole, and a white mark shows where the limit
  ends
*/
function BudgetBar({ spent, expected, limit }: Props) {
  const { formatMessage, formatNumber } = useIntl()
  const { segments, limitAt, percent, percentWithExpected } = getBudgetBarSegments(spent, expected, limit)

  return (
    <div
      role="img"
      aria-label={
        percentWithExpected === null
          ? formatMessage(budgetMessages.barLabel, { percent: formatNumber(percent / 100, { style: 'percent' }) })
          : formatMessage(budgetMessages.barLabelWithExpected, {
              percent: formatNumber(percent / 100, { style: 'percent' }),
              percentWithExpected: formatNumber(percentWithExpected / 100, { style: 'percent' }),
            })
      }
      className="relative mt-1 mb-0.5 h-1.5 overflow-hidden rounded-full bg-neutral-200"
    >
      {segments.map(({ kind, left, width }) => (
        <span
          key={kind}
          className={cn('absolute inset-y-0', SEGMENT_CLASS_NAMES[kind])}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      ))}
      {limitAt === null ? null : (
        <span
          className="absolute inset-y-0 z-1 -ml-[1.5px] w-[3px] bg-white"
          style={{ left: `${limitAt}%` }}
        />
      )}
    </div>
  )
}

export default BudgetBar
