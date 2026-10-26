import type { CSSProperties, ComponentProps, ReactNode } from 'react'
import {
  type DefaultLegendContentProps,
  type DefaultTooltipContentProps,
  Legend,
  ResponsiveContainer,
  Tooltip,
  type TooltipValueType,
} from 'recharts'
import ChartContext, { type ChartConfig } from 'strategydance-design-system/contexts/ChartContext'
import useChart from 'strategydance-design-system/hooks/useChart'
import { cn } from 'strategydance-design-system/lib/utils'

type TooltipNameType = number | string

const INITIAL_DIMENSION = { width: 320, height: 200 } as const

type ChartContainerProps = ComponentProps<'div'> & {
  /** Each series' label, icon and colour, by the key its data uses */
  config: ChartConfig
  /** One recharts chart, as `AreaChart`, which fills the container */
  children: ComponentProps<typeof ResponsiveContainer>['children']
  /** The size the chart is drawn at until the container has measured itself */
  initialDimension?: {
    width: number
    height: number
  }
}

/*
  shadcn's chart, on recharts: the container sizes one recharts chart to itself, 16:9 unless its
  classes say otherwise, and sets each series' colour from the config as `--color-<key>`, which
  the series read as `var(--color-<key>)`. The design has one theme, so the colours are custom
  properties on the container rather than shadcn's stylesheet and its dark copy.

  Its classes put recharts' defaults on the design's tokens: muted ticks, grid and reference lines
  in the border colour. The chart takes the keyboard through recharts' accessibility layer, its
  arrows walking the tooltip from point to point, so its surface shows the design system's focus
  ring where shadcn's hides it
*/
function ChartContainer({
  className,
  style,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: ChartContainerProps) {
  return (
    <ChartContext value={{ config }}>
      <div
        data-slot="chart"
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface:focus-visible]:rounded-xs [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-secondary",
          className,
        )}
        style={{ ...toColorProperties(config), ...style }}
        {...props}
      >
        <ResponsiveContainer initialDimension={initialDimension}>{children}</ResponsiveContainer>
      </div>
    </ChartContext>
  )
}

const ChartTooltip = Tooltip

type ChartTooltipContentProps = ComponentProps<typeof Tooltip>
  & ComponentProps<'div'> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: 'line' | 'dot' | 'dashed'
    nameKey?: string
    labelKey?: string
  } & Omit<DefaultTooltipContentProps<TooltipValueType, TooltipNameType>, 'accessibilityLayer'>

/*
  The box a `ChartTooltip` draws: the label, then a row per series with its key, its label and its
  value. `formatter` draws a row whole, `labelFormatter` the label, and `payload` can be handed
  rows of the caller's own, as a content function does to list what a point holds rather than what
  the chart draws
*/
function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  const tooltipLabel = hideLabel ? null : readTooltipLabel()
  const nestLabel = payload.length === 1 && indicator !== 'dot'

  function readTooltipLabel(): ReactNode {
    const [item] = payload!
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? 'value'}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value = !labelKey && typeof label === 'string' ? (config[label]?.label ?? label) : itemConfig?.label

    if (labelFormatter) {
      return <div className={cn('font-semibold text-secondary', labelClassName)}>{labelFormatter(value, payload!)}</div>
    }

    if (!value) return null

    return <div className={cn('font-semibold text-secondary', labelClassName)}>{value}</div>
  }

  return (
    <div
      className={cn(
        'grid min-w-32 items-start gap-1.5 rounded-xs border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
        className,
      )}
    >
      {nestLabel ? null : tooltipLabel}
      <div className="grid gap-1.5">
        {payload
          .filter(item => item.type !== 'none')
          .map((item, index) => {
            const key = `${nameKey ?? item.name ?? item.dataKey ?? 'value'}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color ?? item.payload?.fill ?? item.color

            return (
              <div
                key={index}
                className={cn(
                  'flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground',
                  indicator === 'dot' && 'items-center',
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn('shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)', {
                            'size-2': indicator === 'dot',
                            'w-1': indicator === 'line',
                            'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                            'my-0.5': nestLabel && indicator === 'dashed',
                          })}
                          style={
                            {
                              '--color-bg': indicatorColor,
                              '--color-border': indicatorColor,
                            } as CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        'flex flex-1 justify-between leading-none',
                        nestLabel ? 'items-end' : 'items-center',
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
                      </div>
                      {item.value != null && (
                        <span className="font-medium text-secondary tabular-nums">
                          {typeof item.value === 'number' ? item.value.toLocaleString() : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const ChartLegend = Legend

type ChartLegendContentProps = ComponentProps<'div'>
  & DefaultLegendContentProps & {
    hideIcon?: boolean
    nameKey?: string
  }

// The row a `ChartLegend` draws: each series' swatch, or its icon, and its label, in muted text
function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
}: ChartLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4 text-muted-foreground',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload
        .filter(item => item.type !== 'none')
        .map((item, index) => {
          const key = `${nameKey ?? item.dataKey ?? 'value'}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={index}
              className="flex items-center gap-1.5 [&>svg]:size-3 [&>svg]:text-muted-foreground"
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

// Each series' colour as the custom property its series reads
function toColorProperties(config: ChartConfig) {
  return Object.fromEntries(
    Object.entries(config).flatMap(([key, { color }]) => (color ? [[`--color-${key}`, color]] : [])),
  ) as CSSProperties
}

// The config of the series a tooltip or legend item belongs to, by its name key when it has one
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) return undefined

  const payloadPayload =
    'payload' in payload && typeof payload.payload === 'object' && payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (key in payload && typeof payload[key as keyof typeof payload] === 'string') {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload
    && key in payloadPayload
    && typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string
  }

  return configLabelKey in config ? config[configLabelKey] : config[key]
}

export type { ChartConfig }

export { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent }
