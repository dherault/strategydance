type BudgetBarSegmentKind = 'spent' | 'over' | 'expected' | 'expectedOver'

type BudgetBarSegment = {
  kind: BudgetBarSegmentKind
  // Where it starts and how wide it is, in percent of the bar
  left: number
  width: number
}

/*
  The segments of a stat's bar, as the prototype's draws them: what was spent up to the limit, then
  past it, then what is expected up to the limit, then past it. Past 100% the bar spans the whole,
  and `limitAt` places the mark where the limit ends. `percent` and `percentWithExpected` are the
  bar's label: the second only when expected bills add to it
*/
function getBudgetBarSegments(spent: number, expected: number | null, limit: number) {
  const percent = (spent / limit) * 100
  const percentWithExpected = expected === null ? percent : Math.max(percent, ((spent + expected) / limit) * 100)
  const scale = Math.max(100, percentWithExpected)
  const ranges: [BudgetBarSegmentKind, number, number][] = [
    ['spent', 0, Math.min(percent, 100)],
    ['over', 100, percent],
    ['expected', percent, Math.min(percentWithExpected, 100)],
    ['expectedOver', Math.max(percent, 100), percentWithExpected],
  ]

  return {
    segments: ranges
      .filter(([, from, to]) => to > from)
      .map(([kind, from, to]): BudgetBarSegment => ({
        kind,
        left: (from / scale) * 100,
        width: ((to - from) / scale) * 100,
      })),
    limitAt: scale > 100 ? (100 / scale) * 100 : null,
    percent: Math.round(percent),
    percentWithExpected: percentWithExpected > percent ? Math.round(percentWithExpected) : null,
  }
}

export { type BudgetBarSegment, type BudgetBarSegmentKind }

export default getBudgetBarSegments
