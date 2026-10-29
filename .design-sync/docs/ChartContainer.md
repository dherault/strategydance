A chart of figures over time or across categories: the Budget's spending month by month, visits
by channel. It is shadcn's chart on [recharts](https://recharts.github.io): `ChartContainer` sizes
one recharts chart to itself and gives its series their colours, and the chart inside is built
from recharts' own parts, on `window.StrategyDanceDesignSystem.Recharts`. A single figure goes in
text, and a share of a whole, as a budget spent, in a `Progress` bar.

## Usage

```jsx
const { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } = window.StrategyDanceDesignSystem
const { AreaChart, Area, CartesianGrid, XAxis, YAxis } = window.StrategyDanceDesignSystem.Recharts

const visits = [
  { month: 'Jan', organic: 1240, paid: 420 },
  { month: 'Feb', organic: 1380, paid: 610 },
  { month: 'Mar', organic: 1310, paid: 880 },
  { month: 'Apr', organic: 1720, paid: 760 },
  { month: 'May', organic: 2050, paid: 940 },
  { month: 'Jun', organic: 2310, paid: 1120 },
]

const config = {
  organic: { label: 'Organic', color: 'var(--color-primary)' },
  paid: { label: 'Paid', color: 'var(--color-primary-300)' },
}

<ChartContainer config={config} className="aspect-auto h-60 w-full">
  <AreaChart data={visits} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} aria-label="Visits from January to June">
    <CartesianGrid vertical={false} strokeDasharray="3 3" />
    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
    <YAxis width="auto" tickLine={false} axisLine={false} tickMargin={10} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Area dataKey="organic" type="monotone" stackId="visits" fill="var(--color-organic)" fillOpacity={0.15} stroke="var(--color-organic)" strokeWidth={2} />
    <Area dataKey="paid" type="monotone" stackId="visits" fill="var(--color-paid)" fillOpacity={0.15} stroke="var(--color-paid)" strokeWidth={2} />
  </AreaChart>
</ChartContainer>
```

The Budget's year: what each month comes to, one line solid up to the current month and dashed
after it, under a primary-50 area, against the monthly budget. The line is drawn twice, through
two clips the current month's x places, so the halves meet as one curve:

```jsx
const { ChartContainer, ChartTooltip, ChartTooltipContent } = window.StrategyDanceDesignSystem
const { ComposedChart, Area, Line, Curve, ReferenceLine, CartesianGrid, XAxis, YAxis, useXAxisScale, useChartWidth, useChartHeight } = window.StrategyDanceDesignSystem.Recharts

const months = [1590, 924, 1023, 3630, 2228, 3776, 3256, 2373, 2849, 4016, 2292, 2799].map((total, index) => ({
  month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, index, 1)),
  total,
}))

const config = {
  total: { label: 'Spending', color: 'var(--color-primary)' },
}

function YearSplit({ month }) {
  const x = useXAxisScale()?.(month)
  const width = useChartWidth()
  const height = useChartHeight()

  if (x === undefined || !width || !height) return null

  return (
    <defs>
      <clipPath id="spending-past"><rect width={x} height={height} /></clipPath>
      <clipPath id="spending-next"><rect x={x} width={width - x} height={height} /></clipPath>
    </defs>
  )
}

function SpendingChart() {
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <ComposedChart data={months} margin={{ top: 16, right: 12, bottom: 0, left: 0 }} aria-label="Monthly spending in 2026">
        <defs>
          <linearGradient id="spending-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-50)" />
            <stop offset="100%" stopColor="var(--color-primary-50)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YearSplit month="Oct" />
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis width="auto" tickLine={false} axisLine={false} tickMargin={10} ticks={[0, 1000, 2000, 3000, 4000, 5000]} domain={[0, 5000]} tickFormatter={value => (value ? `$${value / 1000}K` : '$0')} />
        <ChartTooltip content={<ChartTooltipContent className="w-44" />} />
        <Area dataKey="total" type="monotone" fill="url(#spending-fill)" stroke="none" activeDot={false} tooltipType="none" isAnimationActive={false} />
        <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={false} isAnimationActive={false} shape={props => <Curve {...props} clipPath="url(#spending-past)" />} />
        <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} strokeDasharray="5 5" opacity={0.7} dot={false} activeDot={false} tooltipType="none" isAnimationActive={false} shape={props => <Curve {...props} clipPath="url(#spending-next)" />} />
        <ReferenceLine y={2500} stroke="var(--color-black)" strokeWidth={1.5} label={{ value: 'Budget $2.5K', position: 'insideBottomLeft' }} />
      </ComposedChart>
    </ChartContainer>
  )
}
```

The page's own tooltip lists the month's spent and expected amounts rather than the line it
hovers, with the change from the month before and how far the month is over or under budget: a
content function hands `ChartTooltipContent` those rows as its `payload` and draws each through
`formatter`.

## Parts

- `ChartContainer`: the box, with the props below, around one recharts chart: `AreaChart`,
  `LineChart`, `BarChart`, `ComposedChart` or `PieChart`
- `ChartTooltip`: recharts' `Tooltip`. `content={<ChartTooltipContent />}` draws it, `cursor`
  styles the line or band under the pointer
- `ChartTooltipContent`: a white box with the xs radius, the label then a row per series, its
  swatch, its label from the config and its value. `indicator` is `dot`, `line` or `dashed`;
  `hideLabel` and `hideIndicator` leave those out; `labelFormatter(label, payload)` draws the
  label, `formatter(value, name, item, index, point)` a row whole; `className` sets its width
- `ChartLegend`: recharts' `Legend`. `content={<ChartLegendContent />}` draws it,
  `verticalAlign="top"` puts it above the chart
- `ChartLegendContent`: a row of each series' swatch and label in muted text. `hideIcon` leaves the
  config's icons out

## Notes

- There is no `data` prop: the recharts chart takes `data`, and each series its `dataKey`
- `config` is keyed by the series' `dataKey`: `label` names it in the tooltip and the legend,
  `color` is a token, which the container sets as a custom property named after the key, so a
  series draws in `var(--color-organic)` for the key `organic`
- 16:9 unless its classes say otherwise: `aspect-auto h-60 w-full` makes it 240px tall and as
  wide as its parent
- Ticks are muted, grid lines in the border colour, and numbers line up with `tabular-nums` on the
  container
- A series kept out of the tooltip and the legend takes `tooltipType="none"` and
  `legendType="none"`
- The keyboard reaches the chart, its arrows walking the tooltip from point to point, inside the
  design system's focus ring. `aria-label` on the recharts chart names it: say what it shows
