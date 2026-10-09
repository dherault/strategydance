import type { Task } from '~types'

import getPositionBetween from '~utils/common/getPositionBetween'

/*
  Where a task lands in a column, in its order and without the task itself: before the task
  `beforeId`, or past the last one when it is null or not in the column. Halfway between its new
  neighbours, or null when they are too close for a float to fit between, and the column needs
  renumbering
*/
function getTaskMovePosition(column: readonly Task[], beforeId: string | null) {
  const beforeIndex = beforeId === null ? -1 : column.findIndex(task => task.id === beforeId)
  const index = beforeIndex < 0 ? column.length : beforeIndex

  return getPositionBetween(column[index - 1]?.position ?? null, column[index]?.position ?? null)
}

export default getTaskMovePosition
