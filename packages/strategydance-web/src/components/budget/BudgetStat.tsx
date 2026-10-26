import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import getBudgetChange from '~utils/budget/getBudgetChange'

import BudgetBar from '~components/budget/BudgetBar'

type Props = {
  label: ReactNode
  value: ReactNode
  // The value and what it is compared with, in minor units, and what that is, as the change's title
  comparison: { value: number; base: number; title: string }
  // The bar's share of the limit, left out without a budget
  bar: { spent: number; expected: number | null; limit: number } | null
  foot: ReactNode
  // Why the stat is over budget, the red dot's tooltip, or null when it is not
  over: string | null
}

/*
  One of the Expenses tab's four numbers: its label, its value with a red dot once it goes over
  budget and its change against what it is compared with, its bar against the limit, and a line
  under it. Its rows sit on the grid's, so the four line up whatever each holds
*/
function BudgetStat({ label, value, comparison, bar, foot, over }: Props) {
  const { formatNumber } = useIntl()
  const change = getBudgetChange(comparison.value, comparison.base)

  return (
    <div className="row-span-4 grid min-w-0 grid-rows-subgrid items-start gap-y-1.5 p-4 first:pl-0 last:pr-0 @max-[820px]:odd:pl-0 @max-[820px]:even:pr-0 @max-[420px]:px-0">
      <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</span>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="m-0 text-3xl leading-[1.15] font-semibold tracking-tight wrap-anywhere text-secondary tabular-nums">
            {value}
          </p>
          {over ? (
            <Tooltip
              content={over}
              isOpenedOnTap
            >
              <span
                role="img"
                tabIndex={0}
                aria-label={over}
                className="size-2.5 shrink-0 cursor-help rounded-full bg-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              />
            </Tooltip>
          ) : null}
        </div>
        {change === null ? null : (
          <span
            title={comparison.title}
            className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground tabular-nums"
          >
            {formatNumber(change / 100, { style: 'percent', signDisplay: 'exceptZero' })}
          </span>
        )}
      </div>
      {bar ? <BudgetBar {...bar} /> : <span />}
      <p className="m-0 truncate text-sm text-muted-foreground tabular-nums">{foot}</p>
    </div>
  )
}

export default BudgetStat
