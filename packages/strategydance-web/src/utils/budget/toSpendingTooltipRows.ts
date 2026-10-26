import type { BudgetChartMonth } from '~types'

/*
  The rows of the chart's tooltip for a month: what it holds rather than what the chart draws, what
  was spent and what is expected, each when there is some, in minor units, or a row saying there is
  nothing
*/
function toSpendingTooltipRows(month: BudgetChartMonth) {
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

export default toSpendingTooltipRows
