import { use } from 'react'
import ChartContext from 'strategydance-design-system/contexts/ChartContext'

function useChart() {
  const context = use(ChartContext)

  if (!context) throw new Error('useChart must be used within a <ChartContainer />')

  return context
}

export default useChart
