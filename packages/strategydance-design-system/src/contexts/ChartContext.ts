import { type ComponentType, type ReactNode, createContext } from 'react'

/*
  What a chart calls each of its series, by the key its data uses: the label its tooltip and
  legend show, an icon to show in place of the key's swatch, and its colour, a token, which the
  container sets as `--color-<key>` for the series to read
*/
export type ChartConfig = Record<
  string,
  {
    label?: ReactNode
    icon?: ComponentType
    color?: string
  }
>

export type ChartContextType = {
  config: ChartConfig
}

// Null outside a `ChartContainer`, whose tooltip and legend contents cannot draw without it
export default createContext<ChartContextType | null>(null)
