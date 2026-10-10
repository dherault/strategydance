/*
  Where a row goes to sit between two others, in a list ordered by a float position: halfway
  between them, one past the last, or one before the first. A move then writes that one row.

  Null when the two are so close that no float fits between them, which takes some fifty moves
  into the same gap: the list then needs renumbering
*/
export function getPositionBetween(before: number | null, after: number | null) {
  if (before === null && after === null) return 1
  if (before === null) return after! - 1
  if (after === null) return before + 1

  const position = before + (after - before) / 2

  return position > before && position < after ? position : null
}
