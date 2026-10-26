import { useChartHeight, useChartWidth, useXAxisScale } from 'recharts'

type Props = {
  id: string
  // The current month's name, where the year splits
  month: string
}

/*
  The current month splits the year in two clips, which the line is drawn through twice: one
  monotone curve over the twelve months, solid before the split and dashed after it, so the two
  halves meet with no kink and follow the area's edge
*/
function BudgetSpendingChartClips({ id, month }: Props) {
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

export default BudgetSpendingChartClips
