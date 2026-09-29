import getStreak from '~utils/buildInPublic/getStreak'
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
  streak is, through all of its ticks rather than the days laid out: see `getStreak`
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

  const perItem = items.map((item, index) => ({
    ...item,
    index,
    doneCount: rows.filter(row => row.done[index]).length,
    // Through every tick read, not the window alone, so a run longer than the window is not cut to it
    streak: getStreak([...(ticks.get(item.id) ?? [])], today).current,
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
