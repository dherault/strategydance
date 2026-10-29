/*
  The chart's y axis: round ticks from 0 up past the year's highest month and the budget, with a
  fifth more above them, four to six of them, a step apart of 1, 2, 2.5 or 5 times a power of ten,
  as the prototype's axis steps. Amounts are whole units of the currency. A year of zeros with no
  budget still spans a few units, so no two ticks read "$0"
*/
function getSpendingTicks(totals: readonly number[], limit: number | null) {
  const top = Math.max(...totals, limit ?? 0, 4) * 1.2
  const roughStep = top / 5
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= roughStep)!

  return Array.from({ length: Math.ceil(top / step) + 1 }, (_, index) => index * step)
}

export default getSpendingTicks
