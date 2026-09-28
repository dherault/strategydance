/*
  How many columns the team's priorities are laid out in, at most, favoring square shapes: one,
  two or three side by side, four as two by two, then rows of three. The grid narrows further when
  its section does
*/
function getPriorityColumnCount(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1
  if (count === 2 || count === 4) return 2

  return 3
}

export default getPriorityColumnCount
