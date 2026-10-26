import { useId } from 'react'
import { useIntl } from 'react-intl'
import { Area, CartesianGrid, ComposedChart, Curve, type CurveProps, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { type BudgetSummary, CURRENCIES, type Currency } from 'strategydance-core'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from 'strategydance-design-system/components/ui/Chart'

import type { BudgetChartMonth } from '~types'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'
import formatCompactBudgetAmount from '~utils/budget/formatCompactBudgetAmount'
import getSpendingTicks from '~utils/budget/getSpendingTicks'
import toSpendingTooltipRows from '~utils/budget/toSpendingTooltipRows'

import BudgetSpendingChartClips from '~components/budget/BudgetSpendingChartClips'
import BudgetSpendingTooltipLabel from '~components/budget/BudgetSpendingTooltipLabel'
import BudgetSpendingTooltipRow from '~components/budget/BudgetSpendingTooltipRow'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // Each month of the year, in minor units of `currency`, as `summarizeBudget` gives them
  months: BudgetSummary['months']
  // The budget's monthly limit in minor units, or null without a budget
  monthlyLimit: number | null
  currency: Currency
  year: number
}

/*
  The Expenses tab's "Spending in {year}": what each month comes to, spent and expected, as one
  line under a soft area, solid up to the current month and dashed after it, against the monthly
  budget. It plots whole units of the currency, so its ticks fall on round amounts, and its tooltip
  says what the month holds, as the design system's Chart story draws it
*/
function BudgetSpendingChart({ months, monthlyLimit, currency, year }: Props) {
  const { formatMessage, locale } = useIntl()
  const id = useId()
  const scale = 10 ** CURRENCIES[currency].exponent
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const titleFormat = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const data: BudgetChartMonth[] = months.map((month, index) => ({
    name: monthFormat.format(Date.UTC(year, index, 1)),
    value: (month.spent + month.expected) / scale,
    spent: month.spent,
    expected: month.expected,
  }))
  const currentIndex = Math.max(
    0,
    months.findIndex(month => month.isCurrent),
  )
  const currentName = data[currentIndex]!.name
  const limit = monthlyLimit === null ? null : monthlyLimit / scale
  const ticks = getSpendingTicks(
    data.map(month => month.value),
    limit,
  )
  const chartConfig = {
    spent: { label: formatMessage(budgetMessages.legendSpent), color: 'var(--color-primary)' },
    expected: { label: formatMessage(budgetMessages.legendExpected), color: 'var(--color-primary-200)' },
    limit: { label: formatMessage(budgetMessages.legendMonthlyBudget), color: 'var(--color-black)' },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-60 w-full tabular-nums"
    >
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
        aria-label={formatMessage(budgetMessages.chartLabel, {
          year,
          months: data
            .map(month => `${month.name} ${formatBudgetAmount(month.spent + month.expected, currency, locale)}`)
            .join(', '),
        })}
      >
        <defs>
          <linearGradient
            id={`${id}-fill`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="var(--color-primary-50)"
              stopOpacity={1}
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary-50)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <BudgetSpendingChartClips
          id={id}
          month={currentName}
        />
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
        />
        <ReferenceLine
          y={0}
          stroke="var(--color-border)"
        />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={({ x, y, payload }) => (
            <text
              x={x}
              y={y}
              dy="0.71em"
              textAnchor="middle"
              style={payload.value === currentName ? { fill: 'var(--color-secondary)', fontWeight: 600 } : undefined}
            >
              {payload.value}
            </text>
          )}
        />
        <YAxis
          width="auto"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          domain={[0, ticks.at(-1)!]}
          ticks={ticks}
          tickFormatter={value => formatCompactBudgetAmount(value * scale, currency, locale)}
        />
        <ChartTooltip
          content={({ active, payload }) => {
            const month = payload?.[0]?.payload as BudgetChartMonth | undefined

            if (!month) return null

            const index = data.indexOf(month)

            return (
              <ChartTooltipContent
                active={active}
                payload={toSpendingTooltipRows(month)}
                className="w-44"
                labelFormatter={() => (
                  <BudgetSpendingTooltipLabel
                    title={titleFormat.format(Date.UTC(year, index, 1))}
                    month={month}
                    previous={data[index - 1]}
                  />
                )}
                formatter={(value, name) => (
                  <BudgetSpendingTooltipRow
                    name={String(name)}
                    value={Number(value)}
                    month={month}
                    limit={monthlyLimit}
                    currency={currency}
                  />
                )}
              />
            )
          }}
        />
        <Area
          dataKey="value"
          type="monotone"
          fill={`url(#${id}-fill)`}
          stroke="none"
          activeDot={false}
          isAnimationActive={false}
          tooltipType="none"
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-spent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          shape={(props: CurveProps) => (
            <Curve
              {...props}
              clipPath={`url(#${id}-past)`}
            />
          )}
          dot={({ cx, cy, index }) =>
            index === currentIndex ? (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={4}
                fill="var(--color-spent)"
                stroke="var(--color-white)"
                strokeWidth={2}
              />
            ) : null
          }
          activeDot={{ r: 5, fill: 'var(--color-white)', stroke: 'var(--color-spent)', strokeWidth: 2 }}
          isAnimationActive={false}
          tooltipType="none"
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-spent)"
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinecap="round"
          opacity={0.7}
          shape={(props: CurveProps) => (
            <Curve
              {...props}
              clipPath={`url(#${id}-next)`}
            />
          )}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          tooltipType="none"
        />
        {limit === null ? null : (
          <ReferenceLine
            y={limit}
            stroke="var(--color-limit)"
            strokeWidth={1.5}
            ifOverflow="extendDomain"
            label={({ viewBox }) => (
              <text
                x={(viewBox?.x ?? 0) + 6}
                y={(viewBox?.y ?? 0) - 6}
                style={{
                  fill: 'var(--color-neutral-700)',
                  fontWeight: 500,
                  paintOrder: 'stroke',
                  stroke: 'var(--color-white)',
                  strokeWidth: 4,
                  strokeLinejoin: 'round',
                }}
              >
                {formatMessage(budgetMessages.chartBudgetLabel, {
                  amount: formatCompactBudgetAmount(monthlyLimit!, currency, locale),
                })}
              </text>
            )}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}

export default BudgetSpendingChart
