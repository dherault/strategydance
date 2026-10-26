import type { Meta, StoryObj } from '@storybook/react-vite'
import { type CSSProperties, useId } from 'react'
import {
  Area,
  CartesianGrid,
  Curve,
  type CurveProps,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  useChartHeight,
  useChartWidth,
  useXAxisScale,
} from 'recharts'
import { type BudgetSummary, CURRENCIES, type Currency } from 'strategydance-core'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from 'strategydance-design-system/components/ui/Chart'

/*
  The Budget's "Spending in {year}" chart, as its Expenses tab draws it from `summarizeBudget`'s
  months: what each month comes to, spent and expected, as one line under a soft area, solid up to
  the current month and dashed after it, against the monthly budget
*/

const LOCALE = 'en-US'

type SpendingChartProps = {
  // Each month of the year, in minor units of `currency`, as `summarizeBudget` gives them
  months: BudgetSummary['months']
  // The budget's monthly limit in minor units, or null without a budget
  monthlyLimit: number | null
  currency: Currency
  year: number
}

const chartConfig = {
  spent: {
    label: 'Spent',
    color: 'var(--color-primary)',
  },
  expected: {
    label: 'Expected',
    color: 'var(--color-primary-200)',
  },
  limit: {
    label: 'Monthly budget',
    color: 'var(--color-black)',
  },
} satisfies ChartConfig

type ChartMonth = {
  name: string
  spent: number
  expected: number
  total: number
}

function SpendingChart({ months, monthlyLimit, currency, year }: SpendingChartProps) {
  const id = useId()
  const scale = 10 ** CURRENCIES[currency].exponent
  const monthNames = months.map((_, index) =>
    new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(year, index, 1)),
  )
  // recharts draws whole units of the currency, so its ticks fall on round amounts
  const data: ChartMonth[] = months.map((month, index) => ({
    name: monthNames[index]!,
    spent: month.spent / scale,
    expected: month.expected / scale,
    total: (month.spent + month.expected) / scale,
  }))
  const currentIndex = Math.max(
    0,
    months.findIndex(month => month.isCurrent),
  )
  const limit = monthlyLimit === null ? null : monthlyLimit / scale
  const ticks = getSpendingTicks(data, limit)
  const label = `Monthly spending in ${year}: ${data.map(month => `${month.name} ${formatAmount(month.total, currency)}`).join(', ')}`

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-60 w-full tabular-nums"
    >
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
        aria-label={label}
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
        <SpendingChartClips
          id={id}
          month={monthNames[currentIndex]!}
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
              style={
                payload.value === monthNames[currentIndex]
                  ? { fill: 'var(--color-secondary)', fontWeight: 600 }
                  : undefined
              }
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
          tickFormatter={value => formatCompactAmount(value, currency)}
        />
        <ChartTooltip
          content={({ active, payload }) => {
            const month = payload?.[0]?.payload as ChartMonth | undefined

            if (!month) return null

            const index = data.indexOf(month)

            return (
              <ChartTooltipContent
                active={active}
                payload={toTooltipRows(month)}
                className="w-44"
                labelFormatter={() => (
                  <SpendingTooltipLabel
                    month={month}
                    previous={data[index - 1]}
                    year={year}
                  />
                )}
                formatter={(value, name) => (
                  <SpendingTooltipRow
                    name={String(name)}
                    value={Number(value)}
                    month={month}
                    limit={limit}
                    currency={currency}
                  />
                )}
              />
            )
          }}
        />
        <Area
          dataKey="total"
          type="monotone"
          fill={`url(#${id}-fill)`}
          stroke="none"
          activeDot={false}
          isAnimationActive={false}
          tooltipType="none"
        />
        <Line
          dataKey="total"
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
          dataKey="total"
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
        {limit !== null && (
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
                {`Budget ${formatCompactAmount(limit, currency)}`}
              </text>
            )}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}

/*
  The current month splits the year in two clips, which the line is drawn through twice: one
  monotone curve over the twelve months, solid before the split and dashed after it, so the two
  halves meet with no kink and follow the area's edge
*/
function SpendingChartClips({ id, month }: { id: string; month: string }) {
  const xScale = useXAxisScale()
  const width = useChartWidth()
  const height = useChartHeight()
  const x = xScale?.(month)

  if (x === undefined || !width || !height) return null

  return (
    <defs>
      <clipPath id={`${id}-past`}>
        <rect
          x={0}
          y={0}
          width={x}
          height={height}
        />
      </clipPath>
      <clipPath id={`${id}-next`}>
        <rect
          x={x}
          y={0}
          width={Math.max(0, width - x)}
          height={height}
        />
      </clipPath>
    </defs>
  )
}

// What the month holds rather than what the chart draws: what was spent and what is expected,
// each when there is some, or a row saying there is nothing
function toTooltipRows(month: ChartMonth) {
  const rows = [
    { name: 'spent', dataKey: 'spent', value: month.spent, color: 'var(--color-spent)' },
    { name: 'expected', dataKey: 'expected', value: month.expected, color: 'var(--color-expected)' },
  ].filter(row => row.value > 0)

  return (rows.length ? rows : [{ name: 'nothing', dataKey: 'nothing', value: 0, color: undefined }]).map(row => ({
    ...row,
    payload: month,
    graphicalItemId: row.name,
  }))
}

function SpendingTooltipLabel({ month, previous, year }: { month: ChartMonth; previous?: ChartMonth; year: number }) {
  const change =
    previous && previous.total > 0 ? Math.round(((month.total - previous.total) / previous.total) * 100) : null

  return (
    <span className="flex items-center justify-between gap-2">
      {`${month.name} ${year}`}
      {change !== null && (
        <span
          title={`Compared with ${previous!.name}`}
          className="font-medium text-muted-foreground"
        >
          {`${change > 0 ? '+' : ''}${change}%`}
        </span>
      )}
    </span>
  )
}

type SpendingTooltipRowProps = {
  name: string
  value: number
  month: ChartMonth
  limit: number | null
  currency: Currency
}

/*
  One row of the tooltip, its key and its amount, and after the last one, with a budget, how far
  the month is over or under it, below a rule
*/
function SpendingTooltipRow({ name, value, month, limit, currency }: SpendingTooltipRowProps) {
  const isLast = name === 'nothing' || name === 'expected' || month.expected === 0

  return (
    <>
      {name === 'nothing' ? (
        <span className="text-muted-foreground">Nothing yet</span>
      ) : (
        <>
          <span
            className="size-2 shrink-0 rounded-[2px] bg-(--color-bg)"
            style={{ '--color-bg': `var(--color-${name})` } as CSSProperties}
          />
          <span className="text-muted-foreground">{chartConfig[name as 'spent' | 'expected'].label}</span>
          <span className="ml-auto font-medium text-secondary">{formatAmount(value, currency)}</span>
        </>
      )}
      {isLast && limit !== null && (
        <span className="mt-0.5 flex basis-full items-center border-t border-neutral-100 pt-1.5">
          <span className="text-muted-foreground">{month.total > limit ? 'Over budget by' : 'Under budget by'}</span>
          <span className="ml-auto font-medium text-secondary">
            {formatAmount(Math.abs(limit - month.total), currency)}
          </span>
        </span>
      )}
    </>
  )
}

/*
  Round ticks from 0 up past the year's highest month and the budget, with a fifth more above them:
  four to six, a step apart of 1, 2, 2.5 or 5 times a power of ten, as the prototype's axis steps.
  A year of zeros with no budget still spans a few units of the currency, so no two ticks read "$0"
*/
function getSpendingTicks(data: ChartMonth[], limit: number | null) {
  const top = Math.max(...data.map(month => month.total), limit ?? 0, 4) * 1.2
  const roughStep = top / 5
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= roughStep)!

  return Array.from({ length: Math.ceil(top / step) + 1 }, (_, index) => index * step)
}

function formatAmount(amount: number, currency: Currency) {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCompactAmount(amount: number, currency: Currency) {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/*
  The prototype's seed on October 19, 2026, as strategydance-core's budget test computes it, in
  cents: what each month of 2026 spent and still expects, October being the current month
*/
const SEED_MONTHS: BudgetSummary['months'] = [
  [158983, 0],
  [92397, 0],
  [102297, 0],
  [363049, 0],
  [222832, 0],
  [377632, 0],
  [325558, 0],
  [237332, 0],
  [284906, 0],
  [268123, 133435],
  [0, 229230],
  [0, 279906],
].map(([spent, expected], index) => ({ spent: spent!, expected: expected!, isCurrent: index === 9 }))

// The stories draw the Budget's chart on the white of its page, so their args are its data rather
// than `ChartContainer`'s props, and the meta names no component
const meta = {
  title: 'Components/Chart',
  render: args => (
    <div className="max-w-3xl bg-card p-4">
      <SpendingChart {...args} />
    </div>
  ),
} satisfies Meta<SpendingChartProps>

export default meta

type Story = StoryObj<typeof meta>

// The $2,500 monthly budget the seed is set against
export const Default: Story = {
  args: {
    months: SEED_MONTHS,
    monthlyLimit: 250000,
    currency: 'USD',
    year: 2026,
  },
}

export const WithoutBudget: Story = {
  args: {
    ...Default.args,
    monthlyLimit: null,
  },
}

// A company with no bill yet: a flat line on $0 under the budget
export const YearOfZeros: Story = {
  args: {
    ...Default.args,
    months: SEED_MONTHS.map(month => ({ ...month, spent: 0, expected: 0 })),
  },
}
