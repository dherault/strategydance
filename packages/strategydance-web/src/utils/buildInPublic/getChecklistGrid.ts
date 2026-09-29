import addDays from '~utils/date/addDays'

type Item = {
  id: string
  name: string
}

/*
  A checklist over its last days, oldest first, from the days each item was ticked: which items
  each day has ticked, how many days each item was ticked on and how many in a row it is on now,
  the item on the longest run, the latest day anything was ticked, and how many ticks the last
  week holds.

  An item's run is counted back from today, or from yesterday while today is not ticked yet, as a
  streak is: see `getStreak`
*/
function getChecklistGrid<T extends Item>(items: T[], ticks: Map<string, Set<string>>, today: string, days: number) {
  const rows = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - days + 1)

    return {
      date,
      isToday: date === today,
      done: items.map(item => ticks.get(item.id)?.has(date) ?? false),
    }
  })

  function getRun(index: number) {
    let run = 0

    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
      const row = rows[rowIndex]

      if (row.isToday && !row.done[index]) continue
      if (!row.done[index]) break

      run += 1
    }

    return run
  }

  const perItem = items.map((item, index) => ({
    ...item,
    index,
    doneCount: rows.filter(row => row.done[index]).length,
    streak: getRun(index),
  }))
  const best = perItem.reduce<(typeof perItem)[number] | null>(
    (longest, item) => (!longest || item.streak > longest.streak ? item : longest),
    null,
  )
  const latest = rows.findLast(row => row.done.some(Boolean)) ?? rows[rows.length - 1]
  const weekDoneCount = rows.slice(-7).reduce((sum, row) => sum + row.done.filter(Boolean).length, 0)

  return { rows, perItem, best, latest, weekDoneCount }
}

export default getChecklistGrid
